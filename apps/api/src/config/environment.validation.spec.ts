import { environmentValidationSchema } from './environment.validation';

const validEnvironment = {
  DATABASE_URL: 'postgresql://product_tracker:product_tracker@localhost:5432/product_tracker',
  CHANGEDETECTION_BASE_URL: 'http://localhost:5000',
  APP_BASE_URL: 'http://localhost:3000',
  WEB_BASE_URL: 'http://localhost:5173',
};

describe('environmentValidationSchema', () => {
  it('applies safe defaults for scheduling and external requests', () => {
    const result = environmentValidationSchema.validate(validEnvironment);

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      CHECK_INTERVAL_SECONDS: 86_400,
      CHANGEDETECTION_TIMEOUT_MS: 10_000,
      TELEGRAM_ENABLED: true,
    });
  });

  it('rejects an unsafe high-frequency schedule', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      CHECK_INTERVAL_SECONDS: 60,
    });

    expect(result.error?.message).toContain('CHECK_INTERVAL_SECONDS');
  });

  it('rejects non-http changedetection endpoints', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      CHANGEDETECTION_BASE_URL: 'file:///tmp/datastore',
    });

    expect(result.error?.message).toContain('CHANGEDETECTION_BASE_URL');
  });
});
