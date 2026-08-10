import * as Joi from 'joi';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  CHANGEDETECTION_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  CHANGEDETECTION_API_KEY: Joi.string().allow('').optional(),
  CHANGEDETECTION_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  CHANGEDETECTION_TIMEOUT_MS: Joi.number().integer().min(1_000).max(60_000).default(10_000),
  CHECK_INTERVAL_SECONDS: Joi.number().integer().min(3_600).default(86_400),
  TELEGRAM_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),
  APP_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  WEB_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  PORT: Joi.number().port().default(3000),
});
