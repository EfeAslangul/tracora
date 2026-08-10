import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, ProductStatus, StoreProfileStatus, WatchFetchMode } from '@prisma/client';
import { DomainException } from '../../common/errors/domain.exception';
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
import { presentProduct, type ProductListItem } from './product.presenter';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlSafetyService: UrlSafetyService,
    private readonly profiles: SiteProfileRegistry,
    private readonly watchConfig: ChangedetectionWatchConfigService,
    @Inject(CHANGEDETECTION_CLIENT)
    private readonly changedetection: ChangeDetectionClient,
  ) {}

  async create(input: CreateProductDto): Promise<ProductListItem> {
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

    const product = await this.createPendingProduct(store.id, normalized, input);
    const existingBinding = await this.prisma.watchBinding.findUnique({
      where: { productId: product.id },
    });
    if (existingBinding) {
      try {
        await this.prisma.watchBinding.update({
          where: { id: existingBinding.id },
          data: { lastSyncAt: new Date() },
        });
        await this.changedetection.triggerCheck(existingBinding.externalWatchId);
        const active = await this.prisma.product.update({
          where: { id: product.id },
          data: { status: ProductStatus.ACTIVE, lastErrorCode: null, lastErrorMessage: null },
          include: { store: true },
        });
        return presentProduct(active);
      } catch (error) {
        await this.failProduct(product.id, error);
        throw this.toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
      }
    }
    const requestedMode = profile.fetchMode;
    const initialMode: Exclude<ExternalWatchFetchMode, 'AUTO'> =
      requestedMode === 'BROWSER' ? 'BROWSER' : 'HTTP';
    let externalWatchId: string | null = null;

    try {
      const createdWatch = await this.changedetection.createWatch(
        this.watchConfig.createInput(normalized, initialMode),
      );
      externalWatchId = createdWatch.id;
      await this.prisma.watchBinding.create({
        data: {
          productId: product.id,
          externalWatchId,
          requestedFetchMode: requestedMode as WatchFetchMode,
          fetchMode: initialMode as WatchFetchMode,
        },
      });
    } catch (error) {
      if (externalWatchId)
        await this.changedetection.deleteWatch(externalWatchId).catch(() => undefined);
      await this.failProduct(product.id, error);
      throw this.toDomainError(error, 'WATCH_CREATE_FAILED');
    }

    try {
      await this.changedetection.triggerCheck(externalWatchId);
      const active = await this.prisma.product.update({
        where: { id: product.id },
        data: { status: ProductStatus.ACTIVE, lastErrorCode: null, lastErrorMessage: null },
        include: { store: true },
      });
      return presentProduct(active);
    } catch (error) {
      await this.failProduct(product.id, error);
      throw this.toDomainError(error, 'CHANGEDETECTION_UNAVAILABLE');
    }
  }

  async list(query: ListProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
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

  private async createPendingProduct(
    storeId: string,
    normalizedUrl: string,
    input: CreateProductDto,
  ) {
    try {
      return await this.prisma.product.create({
        data: {
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
          where: { storeId_normalizedUrl: { storeId, normalizedUrl } },
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
    const domainError = this.toDomainError(error, 'WATCH_CREATE_FAILED');
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        status: ProductStatus.FAILED,
        lastErrorCode: domainError.code,
        lastErrorMessage: domainError.message,
      },
    });
  }

  private toDomainError(error: unknown, fallbackCode: string): DomainException {
    if (error instanceof DomainException) return error;
    if (error instanceof ChangeDetectionClientError) {
      return new DomainException(
        error.code,
        error.message,
        error.status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
      );
    }
    return new DomainException(fallbackCode, 'Ürün takibi başlatılamadı.', HttpStatus.BAD_GATEWAY);
  }
}
