import { Module } from '@nestjs/common';
import { NotificationWorkerService } from './notification-worker.service';
import { TelegramGateway } from './telegram.gateway';

@Module({
  providers: [TelegramGateway, NotificationWorkerService],
  exports: [TelegramGateway],
})
export class NotificationsModule {}
