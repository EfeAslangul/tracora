import { ConfigService } from '@nestjs/config';
import { NotificationStatus, ProductStatus, WatchFetchMode } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { NotificationWorkerService } from '../src/modules/notifications/notification-worker.service';
import { TelegramDeliveryError } from '../src/modules/notifications/telegram.errors';
import type { TelegramGateway } from '../src/modules/notifications/telegram.gateway';
import { ObservationService } from '../src/modules/webhooks/observation.service';

describe('Telegram outbox recovery integration', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('product_tracker_test')) {
    throw new Error('Integration tests only run against a product_tracker_test database.');
  }

  const prisma = new PrismaService();
  const send = jest.fn();
  const telegram = { isConfigured: () => true, send } as unknown as TelegramGateway;
  const worker = new NotificationWorkerService(prisma, new ConfigService(), telegram);
  const observations = new ObservationService(prisma);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();
  });

  async function productWithTarget(targetPrice: number) {
    const store = await prisma.store.create({
      data: { hostname: 'shop.example', name: 'shop.example' },
    });
    return prisma.product.create({
      data: {
        storeId: store.id,
        url: 'https://shop.example/product',
        normalizedUrl: 'https://shop.example/product',
        status: ProductStatus.ACTIVE,
        currentPrice: 200,
        currency: 'TRY',
        targetPrice,
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

  async function observePriceDrop(eventId: string, price: string) {
    await observations.process({
      eventId,
      watchId: 'watch-1',
      observedAt: new Date(),
      price,
      currency: 'TRY',
      inStock: true,
    });
  }

  it('retries a transient failure from the outbox and eventually sends', async () => {
    await productWithTarget(100);
    await observePriceDrop('drop-1', '90.00');

    send.mockRejectedValueOnce(
      new TelegramDeliveryError('TELEGRAM_UNAVAILABLE', 'Ulaşılamadı.', false),
    );
    await worker.run();

    const afterFailure = await prisma.notificationDelivery.findFirstOrThrow();
    expect(afterFailure).toMatchObject({
      status: NotificationStatus.FAILED,
      attempts: 1,
      lastErrorCode: 'TELEGRAM_UNAVAILABLE',
    });
    expect(afterFailure.nextAttemptAt).not.toBeNull();
    expect(afterFailure.lockedAt).toBeNull();

    // Bekleme süresi dolmadan tekrar denenmez.
    send.mockResolvedValue(undefined);
    await worker.run();
    await expect(
      prisma.notificationDelivery.count({ where: { status: NotificationStatus.SENT } }),
    ).resolves.toBe(0);

    // Süre dolduğunda aynı kayıt gönderilir.
    await prisma.notificationDelivery.updateMany({
      data: { nextAttemptAt: new Date(Date.now() - 1_000) },
    });
    await worker.run();

    const recovered = await prisma.notificationDelivery.findFirstOrThrow();
    expect(recovered).toMatchObject({ status: NotificationStatus.SENT, attempts: 2 });
    expect(recovered.sentAt).not.toBeNull();
    expect(recovered.nextAttemptAt).toBeNull();
  });

  it('stops retrying after a permanent failure', async () => {
    await productWithTarget(100);
    await observePriceDrop('drop-2', '90.00');

    send.mockRejectedValue(
      new TelegramDeliveryError('TELEGRAM_NOT_CONFIGURED', 'Yapılandırılmamış.', true),
    );
    await worker.run();

    const delivery = await prisma.notificationDelivery.findFirstOrThrow();
    expect(delivery).toMatchObject({ status: NotificationStatus.FAILED, attempts: 1 });
    expect(delivery.nextAttemptAt).toBeNull();

    await worker.run();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget is exhausted', async () => {
    await productWithTarget(100);
    await observePriceDrop('drop-3', '90.00');
    send.mockRejectedValue(
      new TelegramDeliveryError('TELEGRAM_UNAVAILABLE', 'Ulaşılamadı.', false),
    );

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await prisma.notificationDelivery.updateMany({
        data: { nextAttemptAt: new Date(Date.now() - 1_000) },
      });
      await worker.run();
    }

    const delivery = await prisma.notificationDelivery.findFirstOrThrow();
    expect(delivery.attempts).toBe(6);
    expect(delivery.nextAttemptAt).toBeNull();
    expect(send).toHaveBeenCalledTimes(6);
  });

  it('does not send a second message for a duplicate webhook', async () => {
    await productWithTarget(100);
    await observePriceDrop('drop-4', '90.00');
    await observePriceDrop('drop-4', '90.00');

    send.mockResolvedValue(undefined);
    await worker.run();

    await expect(prisma.notificationDelivery.count()).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not run when telegram is not configured', async () => {
    const idle = new NotificationWorkerService(prisma, new ConfigService(), {
      isConfigured: () => false,
      send,
    } as unknown as TelegramGateway);

    await idle.run();

    expect(send).not.toHaveBeenCalled();
  });
});
