import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the Sprint 0 liveness payload', () => {
    expect(new HealthController().getHealth()).toEqual({ status: 'ok', version: '0.1.0' });
  });
});
