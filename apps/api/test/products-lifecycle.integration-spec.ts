import { ConfigService } from '@nestjs/config';
import { ProductStatus, WatchFetchMode } from '@prisma/client';
import type { ChangedetectionWatchConfigService } from '../src/modules/changedetection/changedetection-watch-config.service';
import type { ChangeDetectionClient } from '../src/modules/changedetection/changedetection.types';
import { PrismaService } from '../src/modules/database/prisma.service';
import { ProductsService } from '../src/modules/products/products.service';
import type { SiteProfileRegistry } from '../src/modules/sites/site-profile.registry';
import type { UrlSafetyService } from '../src/modules/sites/url-safety.service';
import { ObservationService } from '../src/modules/webhooks/observation.service';

describe('Product lifecycle integration', () => {
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
  const profiles = {
    resolve: () => ({
      key: 'generic',
      version: 1,
      hostnames: ['*'],
      priority: 0,
      fetchMode: 'AUTO' as const,
      normalizeUrl: (url: URL) => url,
    }),
  };
  const service = new ProductsService(
    prisma,
    { validateAndNormalize: jest.fn() } as unknown as UrlSafetyService,
    profiles as unknown as SiteProfileRegistry,
    {
      createInput: () => ({ url: 'https://shop.example/product' }),
    } as unknown as ChangedetectionWatchConfigService,
    new ConfigService(),
    changedetection,
  );
  const observations = new ObservationService(prisma);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    jest.clearAllMocks();
    changedetection.createWatch.mockResolvedValue({ id: 'watch-new' });
    await prisma.product.deleteMany();
    await prisma.watch.deleteMany();
    await prisma.store.deleteMany();
    await prisma.user.deleteMany();
    userId = (await prisma.user.create({ data: { firebaseUid: 'user-a' } })).id;
  });

  let userId = '';

  async function seed(status: ProductStatus, withWatch = true) {
    const store = await prisma.store.upsert({
      where: { hostname: 'shop.example' },
      create: { hostname: 'shop.example', name: 'shop.example' },
      update: {},
    });
    const watch = withWatch
      ? await prisma.watch.create({
          data: {
            storeId: store.id,
            normalizedUrl: 'https://shop.example/product',
            externalWatchId: 'watch-1',
            requestedFetchMode: WatchFetchMode.AUTO,
            fetchMode: WatchFetchMode.HTTP,
          },
        })
      : null;
    return prisma.product.create({
      data: {
        userId,
        storeId: store.id,
        watchId: watch?.id,
        url: 'https://shop.example/product',
        normalizedUrl: 'https://shop.example/product',
        status,
      },
    });
  }

  it('enforces the manual check cooldown across consecutive calls', async () => {
    const product = await seed(ProductStatus.ACTIVE);

    await expect(service.check(userId, product.id)).resolves.toMatchObject({ accepted: true });
    await expect(service.check(userId, product.id)).rejects.toMatchObject({
      code: 'CHECK_ALREADY_RUNNING',
    });
    expect(changedetection.triggerCheck).toHaveBeenCalledTimes(1);
  });

  it('allows a check again once the cooldown window has passed', async () => {
    const product = await seed(ProductStatus.ACTIVE);
    await prisma.watch.updateMany({
      where: { externalWatchId: 'watch-1' },
      data: { lastTriggeredAt: new Date(Date.now() - 120_000) },
    });

    await expect(service.check(userId, product.id)).resolves.toMatchObject({ accepted: true });
  });

  it('keeps a paused product paused when a webhook observation arrives', async () => {
    const product = await seed(ProductStatus.ACTIVE);
    await service.update(userId, product.id, { status: ProductStatus.PAUSED });
    expect(changedetection.updateWatch).toHaveBeenCalledWith('watch-1', { paused: true });

    await observations.process({
      eventId: 'obs-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-10T12:00:00Z'),
      price: '100.00',
      currency: 'TRY',
      inStock: true,
    });

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(stored.status).toBe(ProductStatus.PAUSED);
    expect(stored.currentPrice?.toString()).toBe('100');
    await expect(prisma.priceSnapshot.count()).resolves.toBe(1);
  });

  it('retries a FAILED product without a watch by provisioning a new one', async () => {
    const product = await seed(ProductStatus.FAILED, false);

    await expect(service.retry(userId, product.id)).resolves.toMatchObject({
      status: ProductStatus.ACTIVE,
    });
    const stored = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { watch: true },
    });
    expect(stored.watch?.externalWatchId).toBe('watch-new');
  });

  it('cascades related rows when a product is deleted', async () => {
    const product = await seed(ProductStatus.ACTIVE);
    await observations.process({
      eventId: 'obs-2',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-10T12:00:00Z'),
      price: '100.00',
      currency: 'TRY',
      inStock: true,
    });

    await service.remove(userId, product.id);

    expect(changedetection.deleteWatch).toHaveBeenCalledWith('watch-1');
    await expect(prisma.product.count()).resolves.toBe(0);
    await expect(prisma.watch.count()).resolves.toBe(0);
    await expect(prisma.priceSnapshot.count()).resolves.toBe(0);
    await expect(prisma.stockSnapshot.count()).resolves.toBe(0);
  });
});
