import { ConfigService } from '@nestjs/config';
import { ProductStatus, WatchFetchMode } from '@prisma/client';
import type { ChangeDetectionClient } from '../src/modules/changedetection/changedetection.types';
import { PrismaService } from '../src/modules/database/prisma.service';
import {
  RECONCILIATION_EVENT,
  RECONCILIATION_KEY,
  ReconciliationService,
} from '../src/modules/reconciliation/reconciliation.service';
import { SystemService } from '../src/modules/system/system.service';
import type { TelegramGateway } from '../src/modules/notifications/telegram.gateway';

describe('ReconciliationService integration', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('product_tracker_test')) {
    throw new Error('Integration tests only run against a product_tracker_test database.');
  }

  const prisma = new PrismaService();
  const changedetection: jest.Mocked<ChangeDetectionClient> = {
    createWatch: jest.fn(),
    updateWatch: jest.fn(),
    deleteWatch: jest.fn(),
    triggerCheck: jest.fn(),
    getWatch: jest.fn(),
    listWatches: jest.fn(),
  };
  const service = new ReconciliationService(prisma, new ConfigService(), changedetection);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.eventLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();
    await prisma.appSetting.deleteMany();
  });

  async function seed(externalWatchId: string) {
    const store = await prisma.store.create({
      data: { hostname: `${externalWatchId}.example`, name: externalWatchId },
    });
    return prisma.product.create({
      data: {
        storeId: store.id,
        url: `https://${externalWatchId}.example/product`,
        normalizedUrl: `https://${externalWatchId}.example/product`,
        status: ProductStatus.ACTIVE,
        watchBinding: {
          create: {
            externalWatchId,
            requestedFetchMode: WatchFetchMode.AUTO,
            fetchMode: WatchFetchMode.HTTP,
          },
        },
      },
    });
  }

  const remoteWatch = (id: string, lastCheckedAt: Date | null) => ({
    id,
    url: `https://${id}.example/product`,
    title: id,
    lastCheckedAt,
    lastChangedAt: null,
    lastError: null,
  });

  it('writes event rows and the lastCompletedAt setting', async () => {
    const product = await seed('watch-1');
    await seed('watch-2');
    changedetection.listWatches.mockResolvedValue([
      // watch-1 eksik, watch-2 güncel, stray orphan.
      remoteWatch('watch-2', new Date()),
      remoteWatch('stray', new Date()),
    ]);

    const report = await service.reconcile();

    expect(report).toMatchObject({ checked: 2, missing: 1, orphaned: 1, drifted: 0 });

    const events = await prisma.eventLog.findMany({ where: { type: RECONCILIATION_EVENT } });
    const codes = events.map((event) => event.code).sort();
    expect(codes).toEqual(['COMPLETED', 'WATCH_MISSING', 'WATCH_ORPHANED']);
    expect(events.find((event) => event.code === 'WATCH_MISSING')?.productId).toBe(product.id);
    expect(events.find((event) => event.code === 'WATCH_ORPHANED')?.productId).toBeNull();

    const setting = await prisma.appSetting.findUniqueOrThrow({
      where: { key: RECONCILIATION_KEY },
    });
    expect(setting.value).toMatchObject({ missing: 1, orphaned: 1 });
  });

  it('reports schedule drift for a stale watch', async () => {
    await seed('watch-1');
    changedetection.listWatches.mockResolvedValue([
      remoteWatch('watch-1', new Date(Date.now() - 40 * 3_600_000)),
    ]);

    await expect(service.reconcile()).resolves.toMatchObject({ drifted: 1 });
    await expect(prisma.eventLog.count({ where: { code: 'SCHEDULE_DRIFT' } })).resolves.toBe(1);
  });

  it('surfaces the last reconciliation through system health', async () => {
    await seed('watch-1');
    changedetection.listWatches.mockResolvedValue([remoteWatch('watch-1', new Date())]);
    await service.reconcile();

    const system = new SystemService(
      prisma,
      new ConfigService(),
      { isConfigured: () => false } as unknown as TelegramGateway,
      changedetection,
    );

    const health = await system.health();

    expect(health.lastReconciliation).toMatchObject({ checked: 1, missing: 0 });
    expect(typeof (health.lastReconciliation as { completedAt: string }).completedAt).toBe(
      'string',
    );
  });

  it('returns null lastReconciliation before the first run', async () => {
    const system = new SystemService(
      prisma,
      new ConfigService(),
      { isConfigured: () => false } as unknown as TelegramGateway,
      changedetection,
    );

    await expect(system.health()).resolves.toMatchObject({ lastReconciliation: null });
  });
});
