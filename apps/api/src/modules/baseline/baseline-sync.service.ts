import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductStatus, WatchFetchMode } from '@prisma/client';
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

  async synchronize(): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Arka plan turları HTTP context'i taşımaz; her tur kendi korelasyon kimliğini alır.
    return runWithContext({ requestId: randomUUID(), source: 'baseline-sync' }, async () => {
      try {
        const products = await this.prisma.product.findMany({
          where: { status: ProductStatus.ACTIVE, lastSuccessfulCheckAt: null },
          include: { watchBinding: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });
        for (const product of products) {
          if (!product.watchBinding) continue;
          await this.synchronizeProduct(product.id, product.watchBinding).catch(
            (error: unknown) => {
              logJson(this.logger, 'warn', 'baseline_sync_failed', {
                productId: product.id,
                error: error instanceof Error ? error.name : 'UnknownError',
              });
            },
          );
        }
      } finally {
        this.running = false;
      }
    });
  }

  private async synchronizeProduct(
    productId: string,
    binding: {
      externalWatchId: string;
      requestedFetchMode: WatchFetchMode;
      fetchMode: WatchFetchMode;
      lastSyncAt?: Date | null;
    },
  ): Promise<void> {
    const watch = await this.changedetection.getWatch(binding.externalWatchId);
    if (!watch.lastCheckedAt) return;
    if (binding.lastSyncAt && watch.lastCheckedAt <= binding.lastSyncAt) return;

    if (
      this.validPrice(watch.observation.price) &&
      this.validCurrency(watch.observation.currency)
    ) {
      await this.observationService.process({
        eventId: `baseline:${binding.externalWatchId}:${watch.lastCheckedAt.toISOString()}`,
        watchId: binding.externalWatchId,
        observedAt: watch.lastCheckedAt,
        price: watch.observation.price,
        currency: watch.observation.currency,
        inStock: watch.observation.inStock,
      });
      await this.prisma.watchBinding.update({
        where: { externalWatchId: binding.externalWatchId },
        data: { lastSyncAt: new Date() },
      });
      return;
    }

    if (
      binding.requestedFetchMode === WatchFetchMode.AUTO &&
      binding.fetchMode === WatchFetchMode.HTTP
    ) {
      await this.changedetection.updateWatch(binding.externalWatchId, { fetchMode: 'BROWSER' });
      await this.prisma.watchBinding.update({
        where: { externalWatchId: binding.externalWatchId },
        data: { fetchMode: WatchFetchMode.BROWSER, lastSyncAt: new Date() },
      });
      try {
        await this.changedetection.triggerCheck(binding.externalWatchId);
      } catch (error) {
        await this.prisma.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.FAILED,
            lastErrorCode: 'CHANGEDETECTION_UNAVAILABLE',
            lastErrorMessage: 'Browser kontrolü başlatılamadı.',
          },
        });
        throw error;
      }
      return;
    }

    const message = watch.lastError
      ? 'Ürün sayfasından fiyat ve para birimi çıkarılamadı.'
      : 'Genel profil bu ürün sayfasından fiyat çıkaramadı.';
    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.FAILED,
          lastCheckedAt: watch.lastCheckedAt,
          lastErrorCode: 'EXTRACTION_UNSUPPORTED',
          lastErrorMessage: message,
        },
      }),
      this.prisma.eventLog.create({
        data: {
          productId,
          type: 'EXTRACTION_ERROR',
          code: 'EXTRACTION_UNSUPPORTED',
          message,
          metadata: { fetchMode: binding.fetchMode },
        },
      }),
    ]);
  }

  private validPrice(value: string | null): value is string {
    return value !== null && /^\d{1,14}(?:\.\d{1,4})?$/.test(value);
  }

  private validCurrency(value: string | null): value is string {
    return value !== null && /^[A-Z]{3}$/.test(value);
  }
}
