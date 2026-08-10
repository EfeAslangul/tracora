import { NotificationType, ProductStatus, WatchFetchMode } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { ObservationService } from '../src/modules/webhooks/observation.service';

describe('ObservationService integration', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('product_tracker_test')) {
    throw new Error('Integration tests only run against a product_tracker_test database.');
  }

  const prisma = new PrismaService();
  const service = new ObservationService(prisma);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();
    await prisma.appSetting.deleteMany();
  });

  async function product(targetPrice = 90) {
    const store = await prisma.store.create({
      data: { hostname: 'shop.example', name: 'shop.example' },
    });
    return prisma.product.create({
      data: {
        storeId: store.id,
        name: 'Example',
        url: 'https://shop.example/product',
        normalizedUrl: 'https://shop.example/product',
        targetPrice,
        status: ProductStatus.ACTIVE,
        watchBinding: {
          create: {
            externalWatchId: 'watch-1',
            requestedFetchMode: WatchFetchMode.AUTO,
            fetchMode: WatchFetchMode.HTTP,
          },
        },
      },
    });
  }

  it('stores a baseline without creating a notification', async () => {
    const created = await product();

    await service.process({
      eventId: 'baseline-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-10T12:00:00Z'),
      price: '100.00',
      currency: 'TRY',
      inStock: false,
    });

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.currentPrice?.toString()).toBe('100');
    await expect(prisma.priceSnapshot.count()).resolves.toBe(1);
    await expect(prisma.stockSnapshot.count()).resolves.toBe(1);
    await expect(prisma.notificationDelivery.count()).resolves.toBe(0);
  });

  it('deduplicates events and lets TARGET_REACHED supersede PRICE_CHANGED', async () => {
    await product(90);
    await service.process({
      eventId: 'baseline-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-10T12:00:00Z'),
      price: '100',
      currency: 'TRY',
      inStock: false,
    });
    const targetEvent = {
      eventId: 'change-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-11T12:00:00Z'),
      price: '89.90',
      currency: 'TRY',
      inStock: true,
    };

    await service.process(targetEvent);
    await expect(service.process(targetEvent)).resolves.toEqual({ duplicate: true });

    const deliveries = await prisma.notificationDelivery.findMany({ orderBy: { type: 'asc' } });
    expect(deliveries.map((delivery) => delivery.type)).toEqual([
      NotificationType.TARGET_REACHED,
      NotificationType.RESTOCKED,
    ]);
    await expect(prisma.priceSnapshot.count()).resolves.toBe(2);
    await expect(prisma.stockSnapshot.count()).resolves.toBe(2);
  });
});
