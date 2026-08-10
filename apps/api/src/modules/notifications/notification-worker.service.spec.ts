import { ConfigService } from '@nestjs/config';
import { NotificationStatus, NotificationType } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { NotificationWorkerService } from './notification-worker.service';
import { TelegramDeliveryError } from './telegram.errors';
import type { TelegramGateway } from './telegram.gateway';

describe('NotificationWorkerService', () => {
  const delivery = {
    id: 'delivery-1',
    productId: 'product-1',
    sourceEventKey: 'event-1',
    channel: 'TELEGRAM' as const,
    type: NotificationType.PRICE_CHANGED,
    status: NotificationStatus.PENDING,
    payload: { productName: 'Example', productUrl: 'https://example.com' },
    attempts: 0,
    nextAttemptAt: null,
    lockedAt: null,
    sentAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date('2026-08-10T12:00:00Z'),
    updatedAt: new Date('2026-08-10T12:00:00Z'),
  };
  const tx = {
    $queryRaw: jest.fn(),
    notificationDelivery: { updateMany: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    notificationDelivery: { update: jest.fn() },
  };
  const telegram = { isConfigured: jest.fn(), send: jest.fn() };
  const worker = new NotificationWorkerService(
    prisma as unknown as PrismaService,
    new ConfigService(),
    telegram as unknown as TelegramGateway,
  );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-10T12:00:00Z'));
    jest.clearAllMocks();
    telegram.isConfigured.mockReturnValue(true);
    tx.$queryRaw.mockResolvedValue([{ id: delivery.id }]);
    tx.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    tx.notificationDelivery.findMany.mockResolvedValue([delivery]);
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    prisma.notificationDelivery.update.mockResolvedValue(delivery);
  });

  afterEach(() => jest.useRealTimers());

  it('uses Telegram retry_after when a delivery is rate limited', async () => {
    telegram.send.mockRejectedValue(
      new TelegramDeliveryError('TELEGRAM_RATE_LIMITED', 'Rate limited.', false, 42),
    );

    await worker.run();

    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: delivery.id },
        data: expect.objectContaining({
          status: NotificationStatus.FAILED,
          attempts: 1,
          nextAttemptAt: new Date('2026-08-10T12:00:42Z'),
        }),
      }),
    );
  });

  it('does not claim work while Telegram is not configured', async () => {
    telegram.isConfigured.mockReturnValue(false);

    await worker.run();

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
