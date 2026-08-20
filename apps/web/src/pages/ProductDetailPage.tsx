import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LoadingState } from '../components/LoadingState';
import {
  checkProduct,
  deleteProduct,
  getProduct,
  retryProduct,
  updateProduct,
} from '../features/products/product.api';
import { ApiError } from '../services/api-client';

function formatCurrency(value: number | null, currency: string | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency ?? 'TRY' }).format(
    value,
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('tr-TR') : '—';
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const product = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['product', id] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);

  const check = useMutation({
    mutationFn: () => checkProduct(id as string),
    onSuccess: invalidate,
  });
  const retry = useMutation({
    mutationFn: () => retryProduct(id as string),
    onSuccess: invalidate,
  });
  const toggleStatus = useMutation({
    mutationFn: () =>
      updateProduct(id as string, {
        status: product.data?.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => deleteProduct(id as string),
    onSuccess: () => navigate('/products'),
  });

  if (!id) return null;

  if (product.isPending) return <LoadingState message="Ürün yükleniyor…" />;

  if (product.isError) {
    return (
      <section className="content narrow">
        <div className="state-card error" role="alert">
          Ürün alınamadı. Biraz sonra tekrar deneyin.
        </div>
        <p>
          <Link to="/products">Ürün listesine dön</Link>
        </p>
      </section>
    );
  }

  const data = product.data;
  const changePercent =
    data.currentPrice !== null && data.previousPrice
      ? ((data.currentPrice - data.previousPrice) / data.previousPrice) * 100
      : null;
  const chartData = data.priceHistory.map((point) => ({
    label: new Date(point.observedAt).toLocaleDateString('tr-TR'),
    price: point.price,
  }));
  const mutationError = check.error ?? retry.error ?? toggleStatus.error ?? remove.error;

  return (
    <section className="content narrow" aria-labelledby="product-detail-title">
      <p>
        <Link to="/products">← Ürün listesine dön</Link>
      </p>
      <div className="page-heading">
        <div>
          <span className={`status status-${data.status.toLowerCase()}`}>{data.status}</span>
          <h1 id="product-detail-title">{data.name ?? data.hostname}</h1>
          <a href={data.url} target="_blank" rel="noreferrer" className="product-url">
            {data.url}
          </a>
        </div>
        <strong className="price">{formatCurrency(data.currentPrice, data.currency)}</strong>
      </div>

      <dl className="product-meta detail-meta">
        <div>
          <dt>Önceki fiyat</dt>
          <dd>{formatCurrency(data.previousPrice, data.currency)}</dd>
        </div>
        <div>
          <dt>Değişim</dt>
          <dd>{changePercent === null ? '—' : `${changePercent.toFixed(1)}%`}</dd>
        </div>
        <div>
          <dt>Hedef fiyat</dt>
          <dd>{formatCurrency(data.targetPrice, data.currency)}</dd>
        </div>
        <div>
          <dt>Stok</dt>
          <dd>{data.inStock === null ? 'Bilinmiyor' : data.inStock ? 'Var' : 'Yok'}</dd>
        </div>
        <div>
          <dt>Son kontrol</dt>
          <dd>{formatDate(data.lastCheckedAt)}</dd>
        </div>
      </dl>

      {data.lastError && (
        <p className="inline-error" role="alert">
          {data.lastError.message}
        </p>
      )}

      <div className="chart-card" role="figure" aria-label="Fiyat geçmişi grafiği">
        <h2>Fiyat geçmişi</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={70} />
              <Tooltip formatter={(value: number) => formatCurrency(value, data.currency)} />
              <Line type="monotone" dataKey="price" stroke="#216869" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="lead">Henüz fiyat geçmişi yok.</p>
        )}
      </div>

      <div className="actions">
        <button
          className="button primary"
          type="button"
          disabled={check.isPending || data.status === 'PAUSED'}
          onClick={() => check.mutate()}
        >
          {check.isPending ? 'Kontrol ediliyor…' : 'Manuel kontrol'}
        </button>
        {data.status === 'FAILED' && (
          <button
            className="button primary"
            type="button"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            {retry.isPending ? 'Yeniden deneniyor…' : 'Yeniden dene'}
          </button>
        )}
        <button
          className="button secondary"
          type="button"
          disabled={toggleStatus.isPending}
          onClick={() => toggleStatus.mutate()}
        >
          {data.status === 'PAUSED' ? 'Aktif et' : 'Duraklat'}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
              remove.mutate();
            }
          }}
        >
          Sil
        </button>
      </div>

      {mutationError && (
        <div className="inline-error" role="alert">
          {mutationError instanceof ApiError ? mutationError.message : 'İşlem tamamlanamadı.'}
        </div>
      )}
    </section>
  );
}
