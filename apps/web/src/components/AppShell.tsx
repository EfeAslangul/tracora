import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { getSystemHealth } from '../features/system/system.api';

export function AppShell({ children }: PropsWithChildren) {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 60_000,
    retry: 1,
  });
  const statusText = !health.data
    ? 'Sistem durumu: kontrol ediliyor'
    : health.data.status === 'ok' && health.data.services.telegram === 'ready'
      ? 'Sistem hazır'
      : health.data.services.telegram === 'not_configured' && health.data.status === 'ok'
        ? 'Sistem hazır · Telegram ayarlı değil'
        : 'Sistem durumu: dikkat gerekli';

  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="Product Tracker ana sayfa">
          Product Tracker
        </a>
        <span className="system-status" role="status">
          {statusText}
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
