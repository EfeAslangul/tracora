import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { environmentValidationSchema } from './config/environment.validation';
import { BaselineModule } from './modules/baseline/baseline.module';
import { ChangedetectionModule } from './modules/changedetection/changedetection.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductsModule } from './modules/products/products.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SystemModule } from './modules/system/system.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: environmentValidationSchema,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    ChangedetectionModule,
    ProductsModule,
    SettingsModule,
    WebhooksModule,
    BaselineModule,
    NotificationsModule,
    SystemModule,
  ],
})
export class AppModule {}
