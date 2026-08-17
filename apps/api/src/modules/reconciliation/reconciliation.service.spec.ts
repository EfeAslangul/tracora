import { ConfigService } from '@nestjs/config';
import { ProductStatus } from '@prisma/client';
import type { ChangeDetectionClient } from '../changedetection/changedetection.types';
import type { PrismaService } from '../database/prisma.service';
import { ReconciliationService } from './reconciliation.service';

const now = new Date('2026-08-10T12:00:00Z');

const watch = (id: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  id,
  url: `https://shop.example/${id}`,
  title: id,
  lastCheckedAt: new Date(now.getTime() - 3_600_000),
  lastChangedAt: null,
  lastError: null,
  ...overrides,
});

const binding = (externalWatchId: string, status: ProductStatus = ProductStatus.ACTIVE) => ({
  id: `binding-${externalWatchId}`,
  productId: `product-${externalWatchId}`,
  externalWatchId,
  product: { id: `product-${externalWatchId}`, status, url: 'https://shop.example/product' },
});

describe('ReconciliationService', () => {
  const prisma = {
    watchBinding: { findMany: jest.fn() },
    eventLog: { createMany: jest.fn(), create: jest.fn() },
    appSetting: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  const changedetection: jest.Mocked<ChangeDetectionClient> = {
    createWatch: jest.fn(),
    updateWatch: jest.fn(),
    deleteWatch: jest.fn(),
    triggerCheck: jest.fn(),
    getWatch: jest.fn(),
    listWatches: jest.fn(),
  };

  const service = new ReconciliationService(
    prisma as unknown as PrismaService,
    new ConfigService(),
    changedetection,
  );

  const rows = () => prisma.eventLog.createMany.mock.calls[0]?.[0]?.data ?? [];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.$transaction.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('reports nothing but a summary when everything matches', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([watch('watch-1')]);

    const report = await service.reconcile();

    expect(report).toEqual({
      checked: 1,
      missing: 0,
      orphaned: 0,
      drifted: 0,
      watchErrors: 0,
    });
    expect(prisma.eventLog.createMany).not.toHaveBeenCalled();
    expect(prisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'COMPLETED' }) }),
    );
    expect(prisma.appSetting.upsert).toHaveBeenCalled();
  });

  it('reports a binding whose remote watch is gone', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([]);

    const report = await service.reconcile();

    expect(report).toMatchObject({ missing: 1 });
    expect(rows()).toEqual([
      expect.objectContaining({ code: 'WATCH_MISSING', productId: 'product-watch-1' }),
    ]);
  });

  it('reports a remote watch with no binding', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([]);
    changedetection.listWatches.mockResolvedValue([watch('stray')]);

    const report = await service.reconcile();

    expect(report).toMatchObject({ orphaned: 1 });
    expect(rows()).toEqual([expect.objectContaining({ code: 'WATCH_ORPHANED', productId: null })]);
  });

  it('reports schedule drift past the stale threshold', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([
      // 86400 * 1.25 = 30 saat eşiği; 40 saat sapmadır.
      watch('watch-1', { lastCheckedAt: new Date(now.getTime() - 40 * 3_600_000) }),
    ]);

    const report = await service.reconcile();

    expect(report).toMatchObject({ drifted: 1 });
    expect(rows()).toEqual([expect.objectContaining({ code: 'SCHEDULE_DRIFT' })]);
  });

  it('treats a never-checked watch as drift', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([watch('watch-1', { lastCheckedAt: null })]);

    await expect(service.reconcile()).resolves.toMatchObject({ drifted: 1 });
  });

  it('reports an upstream watch error for active products', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([watch('watch-1', { lastError: 'timeout' })]);

    const report = await service.reconcile();

    expect(report).toMatchObject({ watchErrors: 1 });
    expect(rows()).toEqual([
      expect.objectContaining({ code: 'WATCH_ERROR_REPORTED', message: 'timeout' }),
    ]);
  });

  it('skips drift and error checks for non-active products', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1', ProductStatus.PAUSED)]);
    changedetection.listWatches.mockResolvedValue([
      watch('watch-1', { lastCheckedAt: null, lastError: 'timeout' }),
    ]);

    await expect(service.reconcile()).resolves.toMatchObject({ drifted: 0, watchErrors: 0 });
  });

  it('never repairs anything automatically', async () => {
    prisma.watchBinding.findMany.mockResolvedValue([binding('watch-1')]);
    changedetection.listWatches.mockResolvedValue([watch('stray')]);

    await service.reconcile();

    expect(changedetection.createWatch).not.toHaveBeenCalled();
    expect(changedetection.deleteWatch).not.toHaveBeenCalled();
    expect(changedetection.updateWatch).not.toHaveBeenCalled();
  });

  it('does not run concurrently', async () => {
    let release: () => void = () => undefined;
    prisma.watchBinding.findMany.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );
    changedetection.listWatches.mockResolvedValue([]);

    const first = service.reconcile();
    await expect(service.reconcile()).resolves.toBeNull();
    release();
    await first;
  });

  it('skips the cron run when disabled', async () => {
    const disabled = new ReconciliationService(
      prisma as unknown as PrismaService,
      { get: () => false } as unknown as ConfigService,
      changedetection,
    );

    await disabled.handleCron();

    expect(prisma.watchBinding.findMany).not.toHaveBeenCalled();
  });
});
