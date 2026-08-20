import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, ProductStatus } from '@prisma/client';
import {
  CHANGEDETECTION_CLIENT,
  type ChangeDetectionClient,
} from '../changedetection/changedetection.types';
import { PrismaService } from '../database/prisma.service';
import { logJson } from '../../common/logging/log';
import { runWithContext } from '../../common/logging/request-context';
import { randomUUID } from 'node:crypto';

export const RECONCILIATION_KEY = 'reconciliation.lastCompletedAt';
export const RECONCILIATION_EVENT = 'RECONCILIATION';

export interface ReconciliationReport {
  checked: number;
  missing: number;
  orphaned: number;
  drifted: number;
  watchErrors: number;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(CHANGEDETECTION_CLIENT)
    private readonly changedetection: ChangeDetectionClient,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'reconciliation' })
  async handleCron(): Promise<void> {
    if (!this.configService.get<boolean>('RECONCILIATION_ENABLED', true)) return;
    return runWithContext({ requestId: randomUUID(), source: 'reconciliation' }, async () => {
      try {
        const report = await this.reconcile();
        if (report) logJson(this.logger, 'log', 'reconciliation_completed', { ...report });
      } catch (error: unknown) {
        logJson(this.logger, 'warn', 'reconciliation_failed', {
          error: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    });
  }

  async reconcile(): Promise<ReconciliationReport | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const [localWatches, remoteWatches] = await Promise.all([
        this.prisma.watch.findMany({
          include: { products: { select: { id: true, status: true, url: true } } },
        }),
        this.changedetection.listWatches(),
      ]);

      const remote = new Map(remoteWatches.map((watch) => [watch.id, watch]));
      const bound = new Set(localWatches.map((watch) => watch.externalWatchId));
      const rows: Prisma.EventLogCreateManyInput[] = [];
      const report: ReconciliationReport = {
        checked: localWatches.length,
        missing: 0,
        orphaned: 0,
        drifted: 0,
        watchErrors: 0,
      };

      const staleAfterMs = this.staleAfterMs();
      const now = Date.now();

      for (const local of localWatches) {
        // Watch paylaşımlı: bulgular ona bağlı her ürüne ayrı ayrı yazılır ki
        // her sahip kendi ürün geçmişinde görebilsin.
        const productIds = local.products.map((product) => product.id);
        const watch = remote.get(local.externalWatchId);
        if (!watch) {
          report.missing += 1;
          const metadata = { externalWatchId: local.externalWatchId, url: local.normalizedUrl };
          rows.push(
            ...this.forEachProduct(productIds, {
              code: 'WATCH_MISSING',
              message: 'Ürünün changedetection.io watch kaydı bulunamadı.',
              metadata,
            }),
          );
          continue;
        }

        // Sahibi kalmamış yerel watch: uzak tarafta hâlâ çekiliyor ama sonucu
        // kimseye yazılmıyor. ARCHITECTURE §10 gereği yalnız raporlanır.
        if (productIds.length === 0) {
          report.orphaned += 1;
          rows.push({
            productId: null,
            type: RECONCILIATION_EVENT,
            code: 'WATCH_UNOWNED',
            message: 'Hiçbir ürüne bağlı olmayan watch kaydı bulundu.',
            metadata: { externalWatchId: local.externalWatchId, url: local.normalizedUrl },
          });
          continue;
        }

        const activeProductIds = local.products
          .filter((product) => product.status === ProductStatus.ACTIVE)
          .map((product) => product.id);
        if (activeProductIds.length === 0) continue;

        // WatchSummary bir interval alanı taşımaz; schedule sapması ancak
        // lastCheckedAt boşluğundan çıkarılabilir.
        const ageMs = watch.lastCheckedAt ? now - watch.lastCheckedAt.getTime() : null;
        if (ageMs === null || ageMs > staleAfterMs) {
          report.drifted += 1;
          rows.push(
            ...this.forEachProduct(activeProductIds, {
              code: 'SCHEDULE_DRIFT',
              message: 'Watch beklenen aralıkta kontrol edilmemiş.',
              metadata: {
                externalWatchId: local.externalWatchId,
                lastCheckedAt: watch.lastCheckedAt?.toISOString() ?? null,
                staleAfterSeconds: Math.round(staleAfterMs / 1_000),
                ageSeconds: ageMs === null ? null : Math.round(ageMs / 1_000),
              },
            }),
          );
        }

        if (watch.lastError) {
          report.watchErrors += 1;
          rows.push(
            ...this.forEachProduct(activeProductIds, {
              code: 'WATCH_ERROR_REPORTED',
              message: watch.lastError,
              metadata: { externalWatchId: local.externalWatchId },
            }),
          );
        }
      }

      for (const watch of remoteWatches) {
        if (bound.has(watch.id)) continue;
        report.orphaned += 1;
        rows.push({
          productId: null,
          type: RECONCILIATION_EVENT,
          code: 'WATCH_ORPHANED',
          message: 'changedetection.io tarafında karşılığı olmayan watch bulundu.',
          metadata: { externalWatchId: watch.id, url: watch.url },
        });
      }

      const completedAt = new Date();
      // İlk sürümde otomatik düzeltme yapılmaz; yalnız raporlanır (ARCHITECTURE §10).
      await this.prisma.$transaction([
        ...(rows.length > 0 ? [this.prisma.eventLog.createMany({ data: rows })] : []),
        this.prisma.eventLog.create({
          data: {
            type: RECONCILIATION_EVENT,
            code: 'COMPLETED',
            message: 'Reconciliation tamamlandı.',
            metadata: { ...report },
          },
        }),
        this.prisma.appSetting.upsert({
          where: { key: RECONCILIATION_KEY },
          create: {
            key: RECONCILIATION_KEY,
            value: { completedAt: completedAt.toISOString(), ...report },
          },
          update: { value: { completedAt: completedAt.toISOString(), ...report } },
        }),
      ]);

      return report;
    } finally {
      this.running = false;
    }
  }

  private forEachProduct(
    productIds: string[],
    finding: { code: string; message: string; metadata: Prisma.JsonObject },
  ): Prisma.EventLogCreateManyInput[] {
    if (productIds.length === 0) {
      return [
        {
          productId: null,
          type: RECONCILIATION_EVENT,
          code: finding.code,
          message: finding.message,
          metadata: finding.metadata,
        },
      ];
    }
    return productIds.map((productId) => ({
      productId,
      type: RECONCILIATION_EVENT,
      code: finding.code,
      message: finding.message,
      metadata: finding.metadata,
    }));
  }

  private staleAfterMs(): number {
    const intervalSeconds = this.configService.get<number>('CHECK_INTERVAL_SECONDS', 86_400);
    const multiplier = this.configService.get<number>('RECONCILIATION_STALE_MULTIPLIER', 1.25);
    return intervalSeconds * multiplier * 1_000;
  }
}
