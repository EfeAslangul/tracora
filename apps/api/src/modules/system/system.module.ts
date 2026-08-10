import { Module } from '@nestjs/common';
import { ChangedetectionModule } from '../changedetection/changedetection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [ChangedetectionModule, NotificationsModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
