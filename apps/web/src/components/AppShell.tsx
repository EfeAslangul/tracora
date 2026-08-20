import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useAuth } from '../features/auth/auth-context';
import { getSystemHealth } from '../features/system/system.api';
import type { SystemHealth } from '../features/system/system.api';

type StatusTone = 'checking' | 'ok' | 'warning' | 'error';

function describeStatus(health: SystemHealth | undefined): { tone: StatusTone; text: string } {
  if (!health) return { tone: 'checking', text: 'Sistem durumu: kontrol ediliyor' };

  if (health.services.database === 'down' || health.services.changedetection === 'down') {
    return { tone: 'error', text: 'Sistem durumu: dikkat gerekli' };
  }
  if (health.services.telegram === 'degraded') {
    return { tone: 'warning', text: 'Sistem hazır · Telegram bildirimleri şu an ulaşmıyor' };
  }
  if (health.services.telegram === 'not_configured') {
    return { tone: 'warning', text: 'Sistem hazır · Telegram ayarlı değil' };
  }
  if (health.status === 'ok' && health.services.telegram === 'ready') {
    return { tone: 'ok', text: 'Sistem hazır' };
  }
  return { tone: 'error', text: 'Sistem durumu: dikkat gerekli' };
}

export function AppShell({ children }: PropsWithChildren) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 60_000,
    retry: 1,
    // Sistem durumu auth'lu bir uç; oturum yokken sorgulanmaz.
    enabled: auth.user !== null,
  });
  const { tone, text } = describeStatus(health.data);

  async function logout() {
    await auth.logout();
    // Önceki kullanıcının ürün ve kurulum cache'i bir sonraki oturuma sızmamalı.
    queryClient.clear();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="Product Tracker ana sayfa">
          Product Tracker
        </a>
        {auth.user === null ? null : (
          <span className={`system-status system-status-${tone}`} role="status">
            <span className="system-status-dot" aria-hidden="true" />
            {text}
          </span>
        )}
        {auth.user === null ? null : (
          <span className="session">
            {auth.user.email}
            <button className="button secondary" type="button" onClick={() => void logout()}>
              Çıkış
            </button>
          </span>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
