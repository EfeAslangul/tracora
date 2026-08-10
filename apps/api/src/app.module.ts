import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentValidationSchema } from './config/environment.validation';
import { ChangedetectionModule } from './modules/changedetection/changedetection.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: environmentValidationSchema,
    }),
    HealthModule,
    ChangedetectionModule,
  ],
})
export class AppModule {}
