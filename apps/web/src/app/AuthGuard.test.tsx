import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { useAuth, type AuthContextValue } from '../features/auth/auth-context';
import { AuthGuard } from './AuthGuard';

vi.mock('../features/auth/auth-context', () => ({ useAuth: vi.fn() }));

function mockAuth(overrides: Partial<AuthContextValue>) {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    configured: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  } as AuthContextValue);
}

describe('AuthGuard', () => {
  it('waits for the session before deciding', () => {
    mockAuth({ loading: true });

    render(
      <AuthGuard>
        <div>Korunan içerik</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Oturum kontrol ediliyor…')).toBeVisible();
    expect(screen.queryByText('Korunan içerik')).toBeNull();
  });

  it('shows the login screen when there is no session', () => {
    mockAuth({ user: null });

    render(
      <AuthGuard>
        <div>Korunan içerik</div>
      </AuthGuard>,
    );

    expect(screen.getByRole('heading', { name: 'Giriş yapın' })).toBeVisible();
    expect(screen.queryByText('Korunan içerik')).toBeNull();
  });

  it('renders the children once a user is signed in', () => {
    mockAuth({ user: { email: 'user@example.com' } as AuthContextValue['user'] });

    render(
      <AuthGuard>
        <div>Korunan içerik</div>
      </AuthGuard>,
    );

    expect(screen.getByText('Korunan içerik')).toBeVisible();
  });
});
