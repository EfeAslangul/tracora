import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/LoadingState';
import { getSetupStatus } from '../features/setup/setup.api';

export function SetupGuard({ children }: PropsWithChildren) {
  const location = useLocation();
  const setup = useQuery({ queryKey: ['setup-status'], queryFn: getSetupStatus, retry: 1 });

  if (setup.isPending) return <LoadingState message="Kurulum durumu kontrol ediliyor…" />;
  if (setup.isError) {
    return (
      <div className="state-card error" role="alert">
        Sunucuya ulaşılamadı. API ve PostgreSQL servislerinin çalıştığını kontrol edin.
      </div>
    );
  }
  if (setup.data.required && location.pathname !== '/setup') {
    return <Navigate replace to="/setup" />;
  }
  if (!setup.data.required && location.pathname === '/setup') {
    return <Navigate replace to="/products" />;
  }
  return children;
}
