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
    await prisma.watch.deleteMany();
    await prisma.store.deleteMany();
    await prisma.user.deleteMany();
    await prisma.appSetting.deleteMany();
  });

  // Bildirim üretimi sahibin Telegram sohbetine bağlı; chat id verilmezse
  // outbox satırı hiç açılmaz.
  async function product(targetPrice = 90, uid = 'user-a', telegramChatId: string | null = '4242') {
    const store = await prisma.store.upsert({
      where: { hostname: 'shop.example' },
      create: { hostname: 'shop.example', name: 'shop.example' },
      update: {},
    });
    const watch = await prisma.watch.upsert({
      where: {
        storeId_normalizedUrl: {
          storeId: store.id,
          normalizedUrl: 'https://shop.example/product',
        },
      },
      create: {
        storeId: store.id,
        normalizedUrl: 'https://shop.example/product',
        externalWatchId: 'watch-1',
        requestedFetchMode: WatchFetchMode.AUTO,
        fetchMode: WatchFetchMode.HTTP,
      },
      update: {},
    });
    const user = await prisma.user.create({ data: { firebaseUid: uid, telegramChatId } });
    return prisma.product.create({
      data: {
        userId: user.id,
        storeId: store.id,
        watchId: watch.id,
        name: 'Example',
        url: 'https://shop.example/product',
        normalizedUrl: 'https://shop.example/product',
        targetPrice,
        status: ProductStatus.ACTIVE,
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
    await expect(service.process(targetEvent)).resolves.toEqual({ processed: 0, duplicates: 1 });

    const deliveries = await prisma.notificationDelivery.findMany({ orderBy: { type: 'asc' } });
    expect(deliveries.map((delivery) => delivery.type)).toEqual([
      NotificationType.TARGET_REACHED,
      NotificationType.RESTOCKED,
    ]);
    await expect(prisma.priceSnapshot.count()).resolves.toBe(2);
    await expect(prisma.stockSnapshot.count()).resolves.toBe(2);
  });

  it('applies one observation to every product bound to the watch', async () => {
    const first = await product(90, 'user-a');
    const second = await product(1000, 'user-b', null);

    await service.process({
      eventId: 'baseline-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-10T12:00:00Z'),
      price: '100',
      currency: 'TRY',
      inStock: true,
    });
    const result = await service.process({
      eventId: 'change-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-11T12:00:00Z'),
      price: '89.90',
      currency: 'TRY',
      inStock: true,
    });

    expect(result).toEqual({ processed: 2, duplicates: 0 });
    const stored = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
    expect(stored.map((row) => row.currentPrice?.toString())).toEqual(['89.9', '89.9']);
    await expect(prisma.priceSnapshot.count({ where: { productId: first.id } })).resolves.toBe(2);
    await expect(prisma.priceSnapshot.count({ where: { productId: second.id } })).resolves.toBe(2);

    // Telegram sohbeti olmayan ikinci kullanıcı için outbox satırı açılmaz.
    const deliveries = await prisma.notificationDelivery.findMany();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].productId).toBe(first.id);
  });

  it('records an event instead of failing when the watch has no products left', async () => {
    const created = await product();
    await prisma.product.delete({ where: { id: created.id } });

    const result = await service.process({
      eventId: 'orphan-1',
      watchId: 'watch-1',
      observedAt: new Date('2026-08-11T12:00:00Z'),
      price: '10',
      currency: 'TRY',
      inStock: true,
    });

    expect(result).toEqual({ processed: 0, duplicates: 0 });
    const events = await prisma.eventLog.findMany({ where: { code: 'ORPHANED_WATCH' } });
    expect(events).toHaveLength(1);
  });
});
