import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { getProducts } from '../features/products/product.api';
import { ProductListPage } from './ProductListPage';

vi.mock('../features/products/product.api', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
}));

describe('ProductListPage', () => {
  it('shows the empty state returned by the API', async () => {
    vi.mocked(getProducts).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ProductListPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Henüz izlenen ürün yok.')).toBeVisible();
  });
});
