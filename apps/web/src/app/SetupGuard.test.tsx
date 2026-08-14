import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { getSetupStatus } from '../features/setup/setup.api';
import { SetupGuard } from './SetupGuard';

vi.mock('../features/setup/setup.api', () => ({
  getSetupStatus: vi.fn(),
}));

function renderGuard(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <SetupGuard>
          <Routes>
            <Route path="/setup" element={<div>Kurulum ekranı</div>} />
            <Route path="/products" element={<div>Ürün listesi</div>} />
          </Routes>
        </SetupGuard>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SetupGuard', () => {
  it('redirects to /setup when onboarding has not been completed', async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({
      required: true,
      completedAt: null,
      defaultCheckIntervalSeconds: 86400,
      telegram: { configured: false, status: 'not_configured' },
    });

    renderGuard('/products');

    expect(await screen.findByText('Kurulum ekranı')).toBeVisible();
  });

  it('does not show the wizard again after onboarding already completed (e.g. after a restart)', async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({
      required: false,
      completedAt: '2026-08-10T12:00:00Z',
      defaultCheckIntervalSeconds: 86400,
      telegram: { configured: true, status: 'ready' },
    });

    renderGuard('/setup');

    expect(await screen.findByText('Ürün listesi')).toBeVisible();
  });

  it('renders the requested page when onboarding state already matches the route', async () => {
    vi.mocked(getSetupStatus).mockResolvedValue({
      required: false,
      completedAt: '2026-08-10T12:00:00Z',
      defaultCheckIntervalSeconds: 86400,
      telegram: { configured: true, status: 'ready' },
    });

    renderGuard('/products');

    expect(await screen.findByText('Ürün listesi')).toBeVisible();
  });
});
