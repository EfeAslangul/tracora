import { ProductStatus } from '@prisma/client';
import { ChangeDetectionClientError } from '../src/modules/changedetection/changedetection.errors';
import { createTestApi, type TestApi } from './support/app.factory';

interface SetupStatus {
  required: boolean;
  completedAt: string | null;
  defaultCheckIntervalSeconds: number;
  telegram: { configured: boolean; status: string };
}

interface SetupResult {
  completed: boolean;
  completedAt: string | null;
  created: Array<{ id: string; url: string; status: string }>;
  failed: Array<{ url: string; code: string; message: string }>;
}

describe('Setup flow integration', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });
  afterAll(() => api.close());
  beforeEach(async () => {
    await api.reset();
    api.changedetection.triggerCheck.mockResolvedValue();
    api.changedetection.deleteWatch.mockResolvedValue();
  });

  it('requires setup on a clean database', async () => {
    const response = await api.request<SetupStatus>('GET', '/setup/status');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ required: true, completedAt: null });
    expect(response.body.defaultCheckIntervalSeconds).toBe(86_400);
  });

  it('completes with partial success and reports each failure', async () => {
    api.changedetection.createWatch
      .mockResolvedValueOnce({ id: 'watch-a' })
      .mockRejectedValueOnce(
        new ChangeDetectionClientError('WATCH_CREATE_FAILED', 'Takip başlatılamadı.', false, 502),
      );

    const response = await api.request<SetupResult>('POST', '/setup', {
      body: {
        products: [
          { url: 'https://a.example/product' },
          { url: 'https://b.example/product', targetPrice: 100 },
        ],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.completed).toBe(true);
    expect(response.body.created).toHaveLength(1);
    expect(response.body.created[0]).toMatchObject({ status: ProductStatus.ACTIVE });
    expect(response.body.failed).toEqual([
      expect.objectContaining({ url: 'https://b.example/product', code: 'WATCH_CREATE_FAILED' }),
    ]);

    // Başarısız URL kaydı FAILED olarak kalır; retry ile kurtarılabilir.
    const failed = await api.prisma.product.findFirst({
      where: { normalizedUrl: 'https://b.example/product' },
    });
    expect(failed?.status).toBe(ProductStatus.FAILED);
  });

  it('does not complete setup when every url fails', async () => {
    api.changedetection.createWatch.mockRejectedValue(
      new ChangeDetectionClientError('WATCH_CREATE_FAILED', 'Takip başlatılamadı.', false, 502),
    );

    const response = await api.request<{ code: string; details: { failed: unknown[] } }>(
      'POST',
      '/setup',
      { body: { products: [{ url: 'https://a.example/product' }] } },
    );

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('SETUP_HAS_NO_SUCCESSFUL_PRODUCT');
    expect(response.body.details.failed).toHaveLength(1);
    await expect(api.request<SetupStatus>('GET', '/setup/status')).resolves.toMatchObject({
      body: { required: true },
    });
  });

  it('keeps setup completed across restarts and rejects a second run', async () => {
    api.changedetection.createWatch.mockResolvedValue({ id: 'watch-a' });

    const first = await api.request<SetupResult>('POST', '/setup', {
      body: { products: [{ url: 'https://a.example/product' }] },
    });
    expect(first.status).toBe(201);
    expect(first.body.completedAt).not.toBeNull();

    // Sunucu yeniden başlasa da karar veritabanındaki AppSetting'te durur.
    const status = await api.request<SetupStatus>('GET', '/setup/status');
    expect(status.body).toMatchObject({ required: false });
    expect(status.body.completedAt).toBe(first.body.completedAt);

    const second = await api.request<{ code: string }>('POST', '/setup', {
      body: { products: [{ url: 'https://c.example/product' }] },
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SETUP_ALREADY_COMPLETED');
  });

  it('validates the url list', async () => {
    const empty = await api.request<{ code: string }>('POST', '/setup', { body: { products: [] } });
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('INVALID_REQUEST');

    const tooMany = await api.request<{ code: string }>('POST', '/setup', {
      body: {
        products: Array.from({ length: 21 }, (_, index) => ({
          url: `https://x${index}.example/product`,
        })),
      },
    });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.code).toBe('INVALID_REQUEST');
  });
});
