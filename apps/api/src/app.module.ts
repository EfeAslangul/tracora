import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ChangedetectionModule } from './modules/changedetection/changedetection.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
        CHANGEDETECTION_BASE_URL: Joi.string().uri().required(),
        CHANGEDETECTION_API_KEY: Joi.string().allow('').optional(),
        CHANGEDETECTION_WEBHOOK_SECRET: Joi.string().allow('').optional(),
        APP_BASE_URL: Joi.string().uri().required(),
        WEB_BASE_URL: Joi.string().uri().required(),
        PORT: Joi.number().port().default(3000),
      }),
    }),
    HealthModule,
    ChangedetectionModule,
  ],
})
export class AppModule {}
