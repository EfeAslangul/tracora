import { apiClient } from '../../services/api-client';

export interface SystemHealth {
  status: 'ok' | 'degraded';
  services: {
    database: 'up' | 'down';
    changedetection: 'up' | 'down';
    telegram: 'ready' | 'not_configured' | 'degraded';
  };
  outbox: { pending: number; permanentlyFailed: number };
  failedProducts: number;
}

export function getSystemHealth() {
  return apiClient.get<SystemHealth>('/system/health');
}
