import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus, Watch, WatchFetchMode } from '@prisma/client';
import {
  CHANGEDETECTION_CLIENT,
  type ChangeDetectionClient,
} from '../changedetection/changedetection.types';
import { PrismaService } from '../database/prisma.service';
import { ObservationService } from '../webhooks/observation.service';
import { logJson } from '../../common/logging/log';
import { runWithContext } from '../../common/logging/request-context';
import { randomUUID } from 'node:crypto';

@Injectable()
export class BaselineSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BaselineSyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly observationService: ObservationService,
    @Inject(CHANGEDETECTION_CLIENT)
    private readonly changedetection: ChangeDetectionClient,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.get<number>('BASELINE_SYNC_INTERVAL_MS', 5_000);
    this.timer = setInterval(() => void this.synchronize(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Fetch modu ve son gözlem watch'ın özelliğidir, ürünün değil: tur ürünler
   * yerine baseline bekleyen ürünü olan watch'lar üzerinde döner.
   */
  async synchronize(): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Arka plan turları HTTP context'i taşımaz; her tur kendi korelasyon kimliğini alır.
    return runWithContext({ requestId: randomUUID(), source: 'baseline-sync' }, async () => {
      try {
        const watches = await this.prisma.watch.findMany({
          where: {
            products: { some: { status: ProductStatus.ACTIVE, lastSuccessfulCheckAt: null } },
          },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
        for (const watch of watches) {
          await this.synchronizeWatch(watch).catch((error: unknown) => {
            logJson(this.logger, 'warn', 'baseline_sync_failed', {
              watchId: watch.id,
              error: error instanceof Error ? error.name : 'UnknownError',
            });
          });
        }
      } catch (error) {
        // Bir sonraki tur tekrar dener; burada atılan bir hata (ör. geçici bağlantı
        // havuzu zaman aşımı) tüm süreci unhandled rejection ile düşürmemeli.
        logJson(this.logger, 'error', 'baseline_sync_round_failed', {
          error: error instanceof Error ? error.name : 'UnknownError',
        });
      } finally {
        this.running = false;
      }
    });
  }

  private async synchronizeWatch(watch: Watch): Promise<void> {
    const remote = await this.changedetection.getWatch(watch.externalWatchId);
    if (!remote.lastCheckedAt) return;
    if (watch.lastSyncAt && remote.lastCheckedAt <= watch.lastSyncAt) return;

    if (
      this.validPrice(remote.observation.price) &&
      this.validCurrency(remote.observation.currency)
    ) {
      // Gözlem watch'ın tüm ürünlerine fan-out edilir; baseline'ı olan ürünler
      // için sourceEventKey aynı kaldığı için tekrar yazılmaz.
      await this.observationService.process({
        eventId: `baseline:${watch.externalWatchId}:${remote.lastCheckedAt.toISOString()}`,
        watchId: watch.externalWatchId,
        observedAt: remote.lastCheckedAt,
        price: remote.observation.price,
        currency: remote.observation.currency,
        inStock: remote.observation.inStock,
      });
      await this.prisma.watch.update({
        where: { id: watch.id },
        data: { lastSyncAt: remote.lastCheckedAt },
      });
      return;
    }

    if (
      watch.requestedFetchMode === WatchFetchMode.AUTO &&
      watch.fetchMode === WatchFetchMode.HTTP
    ) {
      await this.changedetection.updateWatch(watch.externalWatchId, { fetchMode: 'BROWSER' });
      // `remote.lastCheckedAt` (not a local `new Date()`) — this is compared against
      // changedetection's own clock on the next tick (line 78). Stamping it with our
      // wall clock let a fast BROWSER retry's remote timestamp fall at-or-before this
      // value (clock skew / same-second truncation), permanently short-circuiting the
      // guard above and leaving the watch stuck ACTIVE with no price and no failure.
      await this.prisma.watch.update({
        where: { id: watch.id },
        data: { fetchMode: WatchFetchMode.BROWSER, lastSyncAt: remote.lastCheckedAt },
      });
      try {
        await this.changedetection.triggerCheck(watch.externalWatchId);
      } catch (error) {
        await this.failPendingProducts(watch.id, {
          code: 'CHANGEDETECTION_UNAVAILABLE',
          message: 'Browser kontrolü başlatılamadı.',
        });
        throw error;
      }
      return;
    }

    const message = remote.lastError
      ? 'Ürün sayfasından fiyat ve para birimi çıkarılamadı.'
      : 'Genel profil bu ürün sayfasından fiyat çıkaramadı.';
    await this.failPendingProducts(watch.id, {
      code: 'EXTRACTION_UNSUPPORTED',
      message,
      lastCheckedAt: remote.lastCheckedAt,
      event: { type: 'EXTRACTION_ERROR', metadata: { fetchMode: watch.fetchMode } },
    });
  }

  /**
   * Yalnız baseline bekleyen ürünler işaretlenir: aynı watch'a bağlı, geçmişte
   * başarıyla okunmuş bir ürün yeni katılan birinin hatası yüzünden FAILED'a
   * düşmemeli.
   */
  private async failPendingProducts(
    watchId: string,
    failure: {
      code: string;
      message: string;
      lastCheckedAt?: Date;
      event?: { type: string; metadata: Prisma.JsonObject };
    },
  ): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { watchId, lastSuccessfulCheckAt: null },
      select: { id: true },
    });
    if (products.length === 0) return;
    const ids = products.map((product) => product.id);

    await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { id: { in: ids } },
        data: {
          status: ProductStatus.FAILED,
          lastCheckedAt: failure.lastCheckedAt,
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
        },
      }),
      ...(failure.event
        ? [
            this.prisma.eventLog.createMany({
              data: ids.map((productId) => ({
                productId,
                type: failure.event!.type,
                code: failure.code,
                message: failure.message,
                metadata: failure.event!.metadata,
              })),
            }),
          ]
        : []),
    ]);
  }

  private validPrice(value: string | null): value is string {
    return value !== null && /^\d{1,14}(?:\.\d{1,4})?$/.test(value);
  }

  private validCurrency(value: string | null): value is string {
    return value !== null && /^[A-Z]{3}$/.test(value);
  }
}
