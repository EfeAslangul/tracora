import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LoadingState } from '../components/LoadingState';
import { createProduct, getProducts } from '../features/products/product.api';
import type { ProductInput, ProductListItem } from '../features/products/product.types';
import { ApiError } from '../services/api-client';

const productSchema = z.object({
  url: z.string().url('Geçerli bir ürün bağlantısı girin.'),
  targetPrice: z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : Number(value)),
    z.number().min(0).optional(),
  ),
  notificationsEnabled: z.boolean(),
});

export function ProductListPage() {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    refetchInterval: (query) => {
      const data = query.state.data;
      const awaitingBaseline = data?.items.some(
        (product) =>
          product.status === 'PENDING' ||
          (product.status === 'ACTIVE' && product.lastSuccessfulCheckAt === null),
      );
      return awaitingBaseline ? 3_000 : 60_000;
    },
    refetchOnWindowFocus: true,
  });
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { url: '', targetPrice: undefined, notificationsEnabled: true },
  });
  const create = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return (
    <section className="content" aria-labelledby="products-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Günlük takip</p>
          <h1 id="products-title">Ürünler</h1>
          <p className="lead">Fiyat ve stok sonuçları ilk kontrol tamamlandıkça güncellenir.</p>
        </div>
        {products.data && (
          <span className="count-badge">{products.data.pagination.total} ürün</span>
        )}
      </div>

      <form className="add-product" onSubmit={form.handleSubmit((value) => create.mutate(value))}>
        <h2>Yeni ürün ekle</h2>
        <div className="form-grid">
          <label>
            Ürün bağlantısı
            <input type="url" placeholder="https://…" {...form.register('url')} />
          </label>
          <label>
            Hedef fiyat
            <input type="number" min="0" step="0.01" {...form.register('targetPrice')} />
          </label>
          <label className="checkbox-label compact">
            <input type="checkbox" {...form.register('notificationsEnabled')} />
            Bildirim açık
          </label>
          <button className="button primary" disabled={create.isPending} type="submit">
            {create.isPending ? 'Ekleniyor…' : 'Ürün ekle'}
          </button>
        </div>
        {form.formState.errors.url && (
          <span className="field-error" role="alert">
            {form.formState.errors.url.message}
          </span>
        )}
        {create.error && (
          <div className="inline-error" role="alert">
            {create.error instanceof ApiError ? create.error.message : 'Ürün eklenemedi.'}
          </div>
        )}
      </form>

      {products.isPending && <LoadingState message="Ürünler yükleniyor…" />}
      {products.isError && (
        <div className="state-card error" role="alert">
          Ürünler alınamadı. Biraz sonra tekrar deneyin.
        </div>
      )}
      {products.data?.items.length === 0 && (
        <div className="state-card" role="status">
          Henüz izlenen ürün yok.
        </div>
      )}
      {products.data && products.data.items.length > 0 && (
        <div className="product-grid">
          {products.data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductCard({ product }: { product: ProductListItem }) {
  const price =
    product.currentPrice === null
      ? 'İlk kontrol bekleniyor'
      : new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: product.currency ?? 'TRY',
        }).format(product.currentPrice);
  return (
    <article className="product-card">
      <div className="product-card-header">
        <div>
          <span className={`status status-${product.status.toLowerCase()}`}>{product.status}</span>
          <h2>{product.name ?? product.hostname}</h2>
        </div>
        <strong className="price">{price}</strong>
      </div>
      <a
        href={product.url}
        target="_blank"
        rel="noreferrer"
        className="product-url"
        aria-label={`Ürün sayfasını yeni sekmede aç: ${product.url}`}
      >
        {product.url}
      </a>
      <dl className="product-meta">
        <div>
          <dt>Önceki fiyat</dt>
          <dd>{product.previousPrice ?? '—'}</dd>
        </div>
        <div>
          <dt>Hedef</dt>
          <dd>{product.targetPrice ?? '—'}</dd>
        </div>
        <div>
          <dt>Stok</dt>
          <dd>{product.inStock === null ? 'Bilinmiyor' : product.inStock ? 'Var' : 'Yok'}</dd>
        </div>
        <div>
          <dt>Son kontrol</dt>
          <dd>
            {product.lastCheckedAt ? new Date(product.lastCheckedAt).toLocaleString('tr-TR') : '—'}
          </dd>
        </div>
      </dl>
      {product.lastError && (
        <p className="inline-error" role="alert">
          {product.lastError.message}
        </p>
      )}
    </article>
  );
}
