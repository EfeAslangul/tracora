import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramDeliveryError } from './telegram.errors';
import { TelegramGateway } from './telegram.gateway';
import { logJson } from '../../common/logging/log';
import { runWithContext } from '../../common/logging/request-context';
import { randomUUID } from 'node:crypto';

const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegram: TelegramGateway,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.get<number>('NOTIFICATION_WORKER_INTERVAL_MS', 10_000);
    this.timer = setInterval(() => void this.run(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    if (this.running || !this.telegram.hasToken()) return;
    this.running = true;
    return runWithContext({ requestId: randomUUID(), source: 'notification-worker' }, async () => {
      try {
        const deliveries = await this.claim();
        for (const delivery of deliveries) {
          const chatId = delivery.product.user.telegramChatId;
          if (!chatId) {
            await this.abandon(delivery.id, delivery.attempts);
            continue;
          }
          try {
            await this.telegram.send(chatId, delivery.type, delivery.payload);
            await this.prisma.notificationDelivery.update({
              where: { id: delivery.id },
              data: {
                status: NotificationStatus.SENT,
                attempts: { increment: 1 },
                sentAt: new Date(),
                lockedAt: null,
                nextAttemptAt: null,
                lastErrorCode: null,
                lastErrorMessage: null,
              },
            });
          } catch (error) {
            await this.fail(delivery.id, delivery.attempts, error);
          }
        }
      } finally {
        this.running = false;
      }
    });
  }

  private async claim() {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "NotificationDelivery"
        WHERE
          ("status" = 'PENDING')
          OR ("status" = 'FAILED' AND "attempts" < 6 AND "nextAttemptAt" <= NOW())
          OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '2 minutes')
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 20
      `);
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) return [];
      await tx.notificationDelivery.updateMany({
        where: { id: { in: ids } },
        data: { status: NotificationStatus.PROCESSING, lockedAt: new Date() },
      });
      return tx.notificationDelivery.findMany({
        where: { id: { in: ids } },
        include: { product: { select: { user: { select: { telegramChatId: true } } } } },
      });
    });
  }

  /**
   * Sahibi Telegram sohbetini bağlamamış: yeniden denemek durumu değiştirmez,
   * kayıt kalıcı başarısız olarak kapatılır ve outbox'ta görünür kalır.
   */
  private async abandon(deliveryId: string, previousAttempts: number): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationStatus.FAILED,
        attempts: previousAttempts + 1,
        lockedAt: null,
        nextAttemptAt: null,
        lastErrorCode: 'TELEGRAM_CHAT_NOT_CONFIGURED',
        lastErrorMessage: 'Kullanıcı için Telegram sohbeti tanımlı değil.',
      },
    });
    logJson(this.logger, 'warn', 'telegram_chat_not_configured', { deliveryId });
  }

  private async fail(deliveryId: string, previousAttempts: number, error: unknown): Promise<void> {
    const attempts = previousAttempts + 1;
    const deliveryError =
      error instanceof TelegramDeliveryError
        ? error
        : new TelegramDeliveryError(
            'TELEGRAM_UNAVAILABLE',
            'Telegram servisine ulaşılamadı.',
            false,
          );
    const exhausted = deliveryError.permanent || attempts >= 6;
    const retryDelay = deliveryError.retryAfterSeconds
      ? deliveryError.retryAfterSeconds * 1_000
      : RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationStatus.FAILED,
        attempts,
        lockedAt: null,
        nextAttemptAt: exhausted ? null : new Date(Date.now() + retryDelay),
        lastErrorCode: deliveryError.code,
        lastErrorMessage: deliveryError.message,
      },
    });
    logJson(this.logger, 'warn', 'telegram_delivery_failed', { deliveryId, attempts });
  }
}
