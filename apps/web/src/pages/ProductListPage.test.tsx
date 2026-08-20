import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { getProducts } from '../features/products/product.api';
import type { ProductListItem } from '../features/products/product.types';
import { ProductListPage } from './ProductListPage';

vi.mock('../features/products/product.api', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  retryProduct: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProductListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const failedProduct: ProductListItem = {
  id: 'product-1',
  name: 'Başarısız Ürün',
  url: 'https://shop.example/product',
  hostname: 'shop.example',
  profile: 'generic',
  imageUrl: null,
  status: 'FAILED',
  currentPrice: null,
  previousPrice: null,
  currency: null,
  targetPrice: null,
  inStock: null,
  notificationsEnabled: true,
  lastCheckedAt: null,
  lastSuccessfulCheckAt: null,
  lastError: { code: 'EXTRACTION_UNSUPPORTED', message: 'Fiyat çıkarılamadı.' },
  createdAt: '2026-08-01T12:00:00Z',
};

describe('ProductListPage', () => {
  it('shows the empty state returned by the API', async () => {
    vi.mocked(getProducts).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });

    renderPage();

    expect(await screen.findByText('Henüz izlenen ürün yok.')).toBeVisible();
  });

  it('shows a detail link and a retry button for a FAILED product', async () => {
    vi.mocked(getProducts).mockResolvedValue({
      items: [failedProduct],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    renderPage();

    expect(await screen.findByText('Detaylar')).toBeVisible();
    expect(screen.getByText('Yeniden dene')).toBeVisible();
  });
});
