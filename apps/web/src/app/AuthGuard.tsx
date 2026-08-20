import type { PropsWithChildren } from 'react';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../features/auth/auth-context';
import { LoginPage } from '../pages/LoginPage';

export function AuthGuard({ children }: PropsWithChildren) {
  const auth = useAuth();

  if (auth.loading) return <LoadingState message="Oturum kontrol ediliyor…" />;
  if (!auth.user) return <LoginPage />;
  return children;
}
