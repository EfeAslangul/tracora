import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationStatus, ProductStatus } from '@prisma/client';
import {
  CHANGEDETECTION_CLIENT,
  type ChangeDetectionClient,
} from '../changedetection/changedetection.types';
import { PrismaService } from '../database/prisma.service';
import { TelegramGateway } from '../notifications/telegram.gateway';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegram: TelegramGateway,
    @Inject(CHANGEDETECTION_CLIENT)
    private readonly changedetection: ChangeDetectionClient,
  ) {}

  async health() {
    const [database, changedetection] = await Promise.all([
      this.databaseStatus(),
      this.changedetectionStatus(),
    ]);
    const [pendingNotifications, failedNotifications, failedProducts] =
      database === 'up'
        ? await Promise.all([
            this.prisma.notificationDelivery.count({
              where: {
                status: { in: [NotificationStatus.PENDING, NotificationStatus.PROCESSING] },
              },
            }),
            this.prisma.notificationDelivery.count({
              where: { status: NotificationStatus.FAILED, nextAttemptAt: null },
            }),
            this.prisma.product.count({ where: { status: ProductStatus.FAILED } }),
          ])
        : [0, 0, 0];
    const telegram = !this.telegram.isConfigured()
      ? 'not_configured'
      : failedNotifications > 0
        ? 'degraded'
        : 'ready';

    return {
      status: database === 'up' && changedetection === 'up' ? 'ok' : 'degraded',
      services: { database, changedetection, telegram },
      outbox: { pending: pendingNotifications, permanentlyFailed: failedNotifications },
      failedProducts,
      checkIntervalSeconds: this.configService.get<number>('CHECK_INTERVAL_SECONDS', 86_400),
    };
  }

  private async databaseStatus(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async changedetectionStatus(): Promise<'up' | 'down'> {
    try {
      await this.changedetection.listWatches();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
