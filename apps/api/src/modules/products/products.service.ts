import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus, StoreProfileStatus, Watch, WatchFetchMode } from '@prisma/client';
import { DomainException } from '../../common/errors/domain.exception';
import { toDomainError } from '../../common/errors/to-domain-error';
import {
  CHANGEDETECTION_CLIENT,
  type ChangeDetectionClient,
  type WatchFetchMode as ExternalWatchFetchMode,
} from '../changedetection/changedetection.types';
import { ChangeDetectionClientError } from '../changedetection/changedetection.errors';
import { ChangedetectionWatchConfigService } from '../changedetection/changedetection-watch-config.service';
import { PrismaService } from '../database/prisma.service';
import { SiteProfileRegistry } from '../sites/site-profile.registry';
import { UrlSafetyService } from '../sites/url-safety.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import {
  presentProduct,
  presentProductDetail,
  type ProductDetail,
  type ProductListItem,
} from './product.presenter';

const PRICE_HISTORY_LIMIT = 100;
const STOCK_HISTORY_LIMIT = 50;
const EVENT_LIMIT = 20;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlSafetyService: UrlSafetyService,
    private readonly profiles: SiteProfileRegistry,
    private readonly watchConfig: ChangedetectionWatchConfigService,
    private readonly configService: ConfigService,
    @Inject(CHANGEDETECTION_CLIENT)
    private readonly changedetection: ChangeDetectionClient,
  ) {}

  async create(userId: string, input: CreateProductDto): Promise<ProductListItem> {
    const safeUrl = await this.urlSafetyService.validateAndNormalize(input.url);
    const profile = this.profiles.resolve(safeUrl.hostname.toLowerCase());
    const normalized = profile.normalizeUrl(safeUrl).toString();
    const store = await this.prisma.store.upsert({
      where: { hostname: safeUrl.hostname.toLowerCase() },
      create: {
        hostname: safeUrl.hostname.toLowerCase(),
        name: safeUrl.hostname.toLowerCase(),
        profileKey: profile.key,
        profileVersion: profile.version,
        profileStatus:
          profile.key === 'generic' ? StoreProfileStatus.GENERIC : StoreProfileStatus.VERIFIED,
      },
      update: {},
    });

    const product = await this.createPendingProduct(userId, store.id, normalized, input);

    // Aynı URL'yi başka bir kullanıcı zaten izliyorsa yeni watch açılmaz;
    // tek watch tüm sahiplerine fan-out edilir.
    const existingWatch = await this.prisma.watch.findUnique({
      where: { storeId_normalizedUrl: { storeId: store.id, normalizedUrl: normalized } },
    });
    if (existingWatch) return this.attachExistingWatch(product.id, existingWatch);
    return this.provisionWatch(product.id, store.id, normalized, profile.fetchMode);
  }

  async list(userId: string, query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      userId,
      status: query.status,
      store: query.hostname ? { hostname: query.hostname.toLowerCase() } : undefined,
      lastErrorCode:
        query.hasError === undefined ? undefined : query.hasError ? { not: null } : null,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { url: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { store: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map(presentProduct),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async detail(userId: string, id: string): Promise<ProductDetail> {
    const product = await this.productOrFail(userId, id);
    const [priceSnapshots, stockSnapshots, events] = await this.prisma.$transaction([
      this.prisma.priceSnapshot.findMany({
        where: { productId: id },
        orderBy: { observedAt: 'desc' },
        take: PRICE_HISTORY_LIMIT,
      }),
      this.prisma.stockSnapshot.findMany({
        where: { productId: id },
        orderBy: { observedAt: 'desc' },
        take: STOCK_HISTORY_LIMIT,
      }),
      this.prisma.eventLog.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        take: EVENT_LIMIT,
      }),
    ]);

    return presentProductDetail(product, priceSnapshots, stockSnapshots, events, product.watch);
  }

  async update(userId: string, id: string, input: UpdateProductDto): Promise<ProductListItem> {
    if (
      input.targetPrice === undefined &&
      input.notificationsEnabled === undefined &&
      input.status === undefined
    ) {
      throw new DomainException(
        'INVALID_REQUEST',
        'Güncellenecek en az bir alan gönderilmelidir.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const product = await this.productOrFail(userId, id);

    // PAUSED yalnız yerel bir alan olamaz: ObservationService her gözlemde ürünü
    // ACTIVE'e çektiği için duraklatma changedetection tarafında da uygulanmalı.
    // Paylaşılan watch ancak tüm sahipleri duraklattığında durur.
    if (input.status !== undefined && input.status !== product.status && product.watch) {
      await this.applyWatchPausedState(product.watch, id, input.status);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        targetPrice:
          input.targetPrice === undefined
            ? undefined
            : input.targetPrice === null
              ? null
              : new Prisma.Decimal(input.targetPrice),
        notificationsEnabled: input.notificationsEnabled,
        status: input.status,
      },
      include: { store: true },
    });

    return presentProduct(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const product = await this.productOrFail(userId, id);
    const isLastOwner =
      product.watchId !== null && (await this.otherProductCount(product.watchId, id)) === 0;

    // Önce uzak watch silinir: DB kaydı önce silinseydi changedetection'da sahipsiz
    // bir watch kalır ve webhook üretmeye devam ederdi.
    if (isLastOwner && product.watch) {
      try {
        await this.changedetection.deleteWatch(product.watch.externalWatchId);
      } catch (error) {
        if (!this.isMissingWatch(error)) throw toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      if (!isLastOwner || product.watchId === null) return;
      // `none` koruması: silme kararı verildikten sonra başka bir kullanıcı
      // aynı watch'a bağlanmışsa satır bırakılır.
      await tx.watch.deleteMany({ where: { id: product.watchId, products: { none: {} } } });
    });
  }

  async check(userId: string, id: string): Promise<{ accepted: true; triggeredAt: Date }> {
    const product = await this.productOrFail(userId, id);
    if (!product.watch) {
      throw new DomainException(
        'WATCH_NOT_FOUND',
        'Bu ürün için changedetection.io takibi bulunmuyor.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (product.status === ProductStatus.PAUSED) {
      throw new DomainException(
        'PRODUCT_PAUSED',
        'Duraklatılmış ürün için kontrol tetiklenemez.',
        HttpStatus.CONFLICT,
      );
    }

    const triggeredAt = new Date();
    const cooldownMs = this.configService.get<number>('MANUAL_CHECK_COOLDOWN_MS', 60_000);
    const cutoff = new Date(triggeredAt.getTime() - cooldownMs);
    // Tek atomik UPDATE ... WHERE: eşzamanlı iki istek ikisi birden kazanamaz.
    // Cooldown watch başınadır; amacı upstream fetcher'ı korumak olduğu için
    // aynı URL'yi izleyen kullanıcılar aynı pencereyi paylaşır.
    const { count } = await this.prisma.watch.updateMany({
      where: {
        id: product.watch.id,
        OR: [{ lastTriggeredAt: null }, { lastTriggeredAt: { lt: cutoff } }],
      },
      data: { lastTriggeredAt: triggeredAt },
    });
    if (count === 0) {
      throw new DomainException(
        'CHECK_ALREADY_RUNNING',
        'Bu ürün için kısa süre önce kontrol tetiklendi.',
        HttpStatus.CONFLICT,
      );
    }

    try {
      await this.changedetection.triggerCheck(product.watch.externalWatchId);
    } catch (error) {
      // Geçici bir manuel kontrol hatası ACTIVE ürünü FAILED'a düşürmemeli.
      throw toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
    }

    return { accepted: true, triggeredAt };
  }

  async retry(userId: string, id: string): Promise<ProductListItem> {
    const product = await this.productOrFail(userId, id);
    if (product.status !== ProductStatus.FAILED) {
      throw new DomainException(
        'PRODUCT_NOT_RETRYABLE',
        'Yalnız FAILED durumundaki ürünler yeniden denenebilir.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.PENDING, lastErrorCode: null, lastErrorMessage: null },
    });

    if (product.watch) return this.attachExistingWatch(id, product.watch);

    // normalizedUrl zaten doğrulanmış durumda; yeniden DNS/redirect doğrulaması
    // geçici bir ağ hatasını UNSAFE_PRODUCT_URL'e çevirirdi.
    const profile = this.profiles.resolve(product.store.hostname);
    return this.provisionWatch(id, product.storeId, product.normalizedUrl, profile.fetchMode);
  }

  /**
   * Uzak watch yalnız tüm sahipleri duraklattığında durur; herhangi biri
   * ACTIVE'e döndüğünde yeniden çalışır. Uzak çağrı yerel yazmadan önce
   * yapılır ki changedetection hatası durum değişikliğini iptal etsin.
   */
  private async applyWatchPausedState(
    watch: Watch,
    productId: string,
    nextStatus: ProductStatus,
  ): Promise<void> {
    const otherActive = await this.prisma.product.count({
      where: { watchId: watch.id, id: { not: productId }, status: { not: ProductStatus.PAUSED } },
    });
    const shouldPause = otherActive === 0 && nextStatus === ProductStatus.PAUSED;
    if (shouldPause === watch.paused) return;

    try {
      await this.changedetection.updateWatch(watch.externalWatchId, { paused: shouldPause });
    } catch (error) {
      throw toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
    }
    await this.prisma.watch.update({ where: { id: watch.id }, data: { paused: shouldPause } });
  }

  private otherProductCount(watchId: string, excludedProductId: string): Promise<number> {
    return this.prisma.product.count({ where: { watchId, id: { not: excludedProductId } } });
  }

  private async attachExistingWatch(productId: string, watch: Watch): Promise<ProductListItem> {
    try {
      await this.prisma.watch.update({
        where: { id: watch.id },
        data: {
          lastTriggeredAt: new Date(),
          // Watch'a yeni katılan ürünün baseline'ı yok; lastSyncAt sıfırlanmazsa
          // baseline senkronu "bu sonucu zaten işledim" diyerek onu atlar.
          lastSyncAt: null,
        },
      });
      await this.changedetection.triggerCheck(watch.externalWatchId);
      const active = await this.prisma.product.update({
        where: { id: productId },
        data: {
          watchId: watch.id,
          status: ProductStatus.ACTIVE,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        include: { store: true },
      });
      return presentProduct(active);
    } catch (error) {
      await this.failProduct(productId, error);
      throw toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
    }
  }

  private async provisionWatch(
    productId: string,
    storeId: string,
    normalizedUrl: string,
    requestedMode: ExternalWatchFetchMode,
  ): Promise<ProductListItem> {
    const initialMode: Exclude<ExternalWatchFetchMode, 'AUTO'> =
      requestedMode === 'BROWSER' ? 'BROWSER' : 'HTTP';
    let externalWatchId: string | null = null;
    let watch: Watch;

    try {
      const createdWatch = await this.changedetection.createWatch(
        this.watchConfig.createInput(normalizedUrl, initialMode),
      );
      externalWatchId = createdWatch.id;
      watch = await this.prisma.watch.create({
        data: {
          storeId,
          normalizedUrl,
          externalWatchId,
          requestedFetchMode: requestedMode as WatchFetchMode,
          fetchMode: initialMode as WatchFetchMode,
          // Ürün eklenirken zaten bir kontrol tetikleniyor; cooldown penceresi
          // burada başlamazsa ilk sahip bedava bir manuel kontrol kazanır.
          lastTriggeredAt: new Date(),
        },
      });
    } catch (error) {
      if (externalWatchId)
        await this.changedetection.deleteWatch(externalWatchId).catch(() => undefined);

      // Yarış: aynı URL için başka bir istek watch'ı bizden önce kurmuş.
      // Az önce açtığımız uzak watch yukarıda silindi, mevcut olana bağlanılır.
      const concurrent = await this.concurrentWatch(error, storeId, normalizedUrl);
      if (concurrent) return this.attachExistingWatch(productId, concurrent);

      await this.failProduct(productId, error);
      throw toDomainError(error, 'WATCH_CREATE_FAILED');
    }

    try {
      await this.changedetection.triggerCheck(watch.externalWatchId);
      const active = await this.prisma.product.update({
        where: { id: productId },
        data: {
          watchId: watch.id,
          status: ProductStatus.ACTIVE,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        include: { store: true },
      });
      return presentProduct(active);
    } catch (error) {
      await this.failProduct(productId, error);
      throw toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
    }
  }

  private async concurrentWatch(
    error: unknown,
    storeId: string,
    normalizedUrl: string,
  ): Promise<Watch | null> {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null;
    }
    return this.prisma.watch.findUnique({
      where: { storeId_normalizedUrl: { storeId, normalizedUrl } },
    });
  }

  private async productOrFail(userId: string, id: string) {
    // Başkasının ürünü için 403 değil 404: varlık bilgisi sızdırılmaz.
    const product = await this.prisma.product.findFirst({
      where: { id, userId },
      include: { store: true, watch: true },
    });
    if (!product) {
      throw new DomainException('PRODUCT_NOT_FOUND', 'Ürün bulunamadı.', HttpStatus.NOT_FOUND);
    }
    return product;
  }

  private isMissingWatch(error: unknown): boolean {
    return error instanceof ChangeDetectionClientError && error.code === 'WATCH_NOT_FOUND';
  }

  private async createPendingProduct(
    userId: string,
    storeId: string,
    normalizedUrl: string,
    input: CreateProductDto,
  ) {
    try {
      return await this.prisma.product.create({
        data: {
          userId,
          storeId,
          url: normalizedUrl,
          normalizedUrl,
          targetPrice:
            input.targetPrice === undefined ? undefined : new Prisma.Decimal(input.targetPrice),
          notificationsEnabled: input.notificationsEnabled,
          status: ProductStatus.PENDING,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const failedProduct = await this.prisma.product.findUnique({
          where: { userId_storeId_normalizedUrl: { userId, storeId, normalizedUrl } },
        });
        if (failedProduct?.status === ProductStatus.FAILED) {
          return this.prisma.product.update({
            where: { id: failedProduct.id },
            data: {
              status: ProductStatus.PENDING,
              targetPrice:
                input.targetPrice === undefined ? undefined : new Prisma.Decimal(input.targetPrice),
              notificationsEnabled: input.notificationsEnabled,
              lastErrorCode: null,
              lastErrorMessage: null,
            },
          });
        }
        throw new DomainException(
          'PRODUCT_ALREADY_EXISTS',
          'Bu ürün bağlantısı zaten takip ediliyor.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  private async failProduct(productId: string, error: unknown): Promise<void> {
    const domainError = toDomainError(error, 'WATCH_CREATE_FAILED');
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: ProductStatus.FAILED,
        lastErrorCode: domainError.code,
        lastErrorMessage: domainError.message,
      },
    });
  }
}
