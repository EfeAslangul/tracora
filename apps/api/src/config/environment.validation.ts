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
  // Boş secret uygulamayı açar ama her webhook'u 401'ler: sessiz arıza.
  // Üretimde zorunlu; varsayılan verilmez (varsayılan secret yoktan kötüdür).
  CHANGEDETECTION_WEBHOOK_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CHANGEDETECTION_WEBHOOK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://host.docker.internal:3000/api/v1/webhooks/changedetection'),
  CHANGEDETECTION_TIMEOUT_MS: Joi.number().integer().min(1_000).max(60_000).default(10_000),
  CHECK_INTERVAL_SECONDS: Joi.number().integer().min(3_600).default(86_400),
  BASELINE_SYNC_INTERVAL_MS: Joi.number().integer().min(1_000).max(60_000).default(5_000),
  NOTIFICATION_WORKER_INTERVAL_MS: Joi.number().integer().min(1_000).max(60_000).default(10_000),
  RECONCILIATION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  RECONCILIATION_STALE_MULTIPLIER: Joi.number().min(1).max(10).default(1.25),
  MANUAL_CHECK_COOLDOWN_MS: Joi.number().integer().min(5_000).max(3_600_000).default(60_000),
  URL_VALIDATION_TIMEOUT_MS: Joi.number().integer().min(1_000).max(30_000).default(5_000),
  TELEGRAM_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),
  TELEGRAM_TIMEOUT_MS: Joi.number().integer().min(1_000).max(60_000).default(10_000),
  APP_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  WEB_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  PORT: Joi.number().port().default(3000),
});
