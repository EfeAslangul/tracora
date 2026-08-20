import { environmentValidationSchema } from './environment.validation';

const validEnvironment = {
  DATABASE_URL: 'postgresql://product_tracker:product_tracker@localhost:5432/product_tracker',
  CHANGEDETECTION_BASE_URL: 'http://localhost:5000',
  APP_BASE_URL: 'http://localhost:3000',
  WEB_BASE_URL: 'http://localhost:5173',
};

// Üretimde zorunlu olan Firebase kimlik bilgileri.
const firebaseCredentials = {
  FIREBASE_PROJECT_ID: 'tracora-test',
  FIREBASE_CLIENT_EMAIL: 'sa@tracora-test.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'k'.repeat(64),
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

  it('applies defaults for reconciliation and the manual check cooldown', () => {
    const result = environmentValidationSchema.validate(validEnvironment);

    expect(result.value).toMatchObject({
      MANUAL_CHECK_COOLDOWN_MS: 60_000,
      RECONCILIATION_ENABLED: true,
      RECONCILIATION_STALE_MULTIPLIER: 1.25,
    });
  });

  it('rejects an out-of-range manual check cooldown', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      MANUAL_CHECK_COOLDOWN_MS: 100,
    });

    expect(result.error?.message).toContain('MANUAL_CHECK_COOLDOWN_MS');
  });

  it('allows an empty webhook secret outside production', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'development',
      CHANGEDETECTION_WEBHOOK_SECRET: '',
    });

    expect(result.error).toBeUndefined();
  });

  it('requires a strong webhook secret in production', () => {
    const missing = environmentValidationSchema.validate({
      ...validEnvironment,
      ...firebaseCredentials,
      NODE_ENV: 'production',
    });
    expect(missing.error?.message).toContain('CHANGEDETECTION_WEBHOOK_SECRET');

    const tooShort = environmentValidationSchema.validate({
      ...validEnvironment,
      ...firebaseCredentials,
      NODE_ENV: 'production',
      CHANGEDETECTION_WEBHOOK_SECRET: 'short',
    });
    expect(tooShort.error?.message).toContain('CHANGEDETECTION_WEBHOOK_SECRET');

    const valid = environmentValidationSchema.validate({
      ...validEnvironment,
      ...firebaseCredentials,
      NODE_ENV: 'production',
      CHANGEDETECTION_WEBHOOK_SECRET: 'a'.repeat(64),
    });
    expect(valid.error).toBeUndefined();
  });

  it('allows empty Firebase credentials outside production', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      FIREBASE_PROJECT_ID: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_PRIVATE_KEY: '',
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({ AUTH_REQUIRE_EMAIL_VERIFIED: false });
  });

  it('requires Firebase credentials in production', () => {
    const result = environmentValidationSchema.validate({
      ...validEnvironment,
      NODE_ENV: 'production',
      CHANGEDETECTION_WEBHOOK_SECRET: 'a'.repeat(64),
    });

    expect(result.error?.message).toContain('FIREBASE_PROJECT_ID');
  });
});
