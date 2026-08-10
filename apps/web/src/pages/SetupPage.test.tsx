import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SetupPage } from './SetupPage';

describe('SetupPage', () => {
  it('starts with one accessible product URL field', () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SetupPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Takip edilecek ürünleri ekleyin' })).toBeVisible();
    expect(screen.getByLabelText('Ürün bağlantısı')).toHaveAttribute('type', 'url');
  });
});
