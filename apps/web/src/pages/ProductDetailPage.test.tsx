import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import {
  checkProduct,
  deleteProduct,
  getProduct,
  retryProduct,
  updateProduct,
} from '../features/products/product.api';
import type { ProductDetail } from '../features/products/product.types';
import { ProductDetailPage } from './ProductDetailPage';

vi.mock('../features/products/product.api', () => ({
  getProduct: vi.fn(),
  checkProduct: vi.fn(),
  retryProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

const baseProduct: ProductDetail = {
  id: 'product-1',
  name: 'Örnek Ürün',
  url: 'https://shop.example/product',
  hostname: 'shop.example',
  profile: 'generic',
  imageUrl: null,
  status: 'ACTIVE',
  currentPrice: 1999.9,
  previousPrice: 2299.9,
  currency: 'TRY',
  targetPrice: 1799.9,
  inStock: true,
  notificationsEnabled: true,
  lastCheckedAt: '2026-08-10T12:00:00Z',
  lastSuccessfulCheckAt: '2026-08-10T12:00:00Z',
  lastError: null,
  createdAt: '2026-08-01T12:00:00Z',
  watchId: 'watch-1',
  fetchMode: 'HTTP',
  priceHistory: [{ price: 2299.9, currency: 'TRY', observedAt: '2026-08-09T12:00:00Z' }],
  stockHistory: [{ inStock: true, observedAt: '2026-08-09T12:00:00Z' }],
  recentEvents: [],
};

function renderPage(initialPath = '/products/product-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProductDetailPage', () => {
  it('renders product details from the API', async () => {
    vi.mocked(getProduct).mockResolvedValue(baseProduct);

    renderPage();

    expect(await screen.findByText('Örnek Ürün')).toBeVisible();
    expect(screen.getByText('Manuel kontrol')).toBeVisible();
    expect(screen.queryByText('Yeniden dene')).not.toBeInTheDocument();
  });

  it('shows the retry button only when the product status is FAILED', async () => {
    vi.mocked(getProduct).mockResolvedValue({
      ...baseProduct,
      status: 'FAILED',
      lastError: { code: 'EXTRACTION_UNSUPPORTED', message: 'Fiyat çıkarılamadı.' },
    });

    renderPage();

    expect(await screen.findByText('Yeniden dene')).toBeVisible();
    expect(screen.getByText('Fiyat çıkarılamadı.')).toBeVisible();
  });

  it('triggers a manual check when the button is clicked', async () => {
    vi.mocked(getProduct).mockResolvedValue(baseProduct);
    vi.mocked(checkProduct).mockResolvedValue({ accepted: true, triggeredAt: '2026-08-10T12:00:00Z' });

    renderPage();

    const button = await screen.findByText('Manuel kontrol');
    fireEvent.click(button);

    await waitFor(() => expect(checkProduct).toHaveBeenCalledWith('product-1'));
  });
});

void retryProduct;
void updateProduct;
void deleteProduct;
