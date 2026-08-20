import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/logging/request-id.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { environmentValidationSchema } from './config/environment.validation';
import { AuthModule } from './modules/auth/auth.module';
import { BaselineModule } from './modules/baseline/baseline.module';
import { ChangedetectionModule } from './modules/changedetection/changedetection.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductsModule } from './modules/products/products.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SystemModule } from './modules/system/system.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: environmentValidationSchema,
    }),
    ScheduleModule.forRoot(),
    // Throttler guard global olarak bağlanmaz: webhook uç noktası
    // changedetection.io tek seferde çok sayıda watch bildirebildiği için
    // kısıtlanmamalıdır. Auth guard ise AuthModule içinde global bağlanır.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 30 }]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ChangedetectionModule,
    ProductsModule,
    DashboardModule,
    SettingsModule,
    WebhooksModule,
    BaselineModule,
    NotificationsModule,
    ReconciliationModule,
    SystemModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 bare '*' kalıbını reddeder; adlandırılmış splat gerekir.
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
