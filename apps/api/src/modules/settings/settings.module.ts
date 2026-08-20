import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductsModule } from '../products/products.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [ProductsModule, NotificationsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
