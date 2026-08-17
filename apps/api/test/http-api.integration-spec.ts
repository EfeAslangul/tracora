import { ProductStatus, WatchFetchMode } from '@prisma/client';
import { createTestApi, type ApiResponse, type TestApi } from './support/app.factory';

interface ErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}

describe('HTTP API integration', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });
  afterAll(() => api.close());
  beforeEach(async () => {
    await api.reset();
    api.changedetection.createWatch.mockResolvedValue({ id: 'watch-new' });
    api.changedetection.triggerCheck.mockResolvedValue();
    api.changedetection.deleteWatch.mockResolvedValue();
    api.changedetection.updateWatch.mockResolvedValue();
  });

  async function seedProduct(status: ProductStatus, withBinding = true) {
    const store = await api.prisma.store.create({
      data: { hostname: 'seed.example', name: 'seed.example' },
    });
    return api.prisma.product.create({
      data: {
        storeId: store.id,
        url: 'https://seed.example/product',
        normalizedUrl: 'https://seed.example/product',
        status,
        watchBinding: withBinding
          ? {
              create: {
                externalWatchId: 'watch-seed',
                requestedFetchMode: WatchFetchMode.AUTO,
                fetchMode: WatchFetchMode.HTTP,
              },
            }
          : undefined,
      },
    });
  }

  describe('error envelope and request id', () => {
    it('returns the documented envelope and echoes the request id', async () => {
      const response = await api.request<ErrorBody>(
        'GET',
        '/products/00000000-0000-4000-8000-000000000000',
        { headers: { 'x-request-id': 'req-http-1' } },
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Ürün bulunamadı.',
        details: {},
        requestId: 'req-http-1',
      });
      expect(response.headers.get('x-request-id')).toBe('req-http-1');
    });

    it('generates a request id when the client sends none', async () => {
      const response = await api.request('GET', '/health');

      expect(response.status).toBe(200);
      expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects a malformed uuid with INVALID_REQUEST', async () => {
      const response = await api.request<ErrorBody>('GET', '/products/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /products', () => {
    it('creates a product and rejects the duplicate url', async () => {
      const first = await api.request<{ id: string; status: string }>('POST', '/products', {
        body: { url: 'https://shop.example/product' },
      });
      expect(first.status).toBe(201);
      expect(first.body.status).toBe(ProductStatus.ACTIVE);

      const duplicate = await api.request<ErrorBody>('POST', '/products', {
        body: { url: 'https://shop.example/product' },
      });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.code).toBe('PRODUCT_ALREADY_EXISTS');
    });

    it('rejects unknown fields through the whitelist', async () => {
      const response = await api.request<ErrorBody>('POST', '/products', {
        body: { url: 'https://shop.example/product', sneaky: true },
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(response.body.details).toHaveProperty('fields');
    });
  });

  describe('PATCH /products/:id', () => {
    it('updates the target price', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<{ targetPrice: number }>(
        'PATCH',
        `/products/${product.id}`,
        { body: { targetPrice: 1799.9 } },
      );

      expect(response.status).toBe(200);
      expect(response.body.targetPrice).toBe(1799.9);
      expect(api.changedetection.updateWatch).not.toHaveBeenCalled();
    });

    it('pauses the remote watch when the status changes', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<{ status: string }>('PATCH', `/products/${product.id}`, {
        body: { status: ProductStatus.PAUSED },
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ProductStatus.PAUSED);
      expect(api.changedetection.updateWatch).toHaveBeenCalledWith('watch-seed', { paused: true });
    });

    it('rejects a status the client may not set', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<ErrorBody>('PATCH', `/products/${product.id}`, {
        body: { status: ProductStatus.FAILED },
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });

    it('rejects an empty body', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<ErrorBody>('PATCH', `/products/${product.id}`, {
        body: {},
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /products/:id/check', () => {
    it('accepts the first call and rejects the second within the cooldown', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const first = await api.request('POST', `/products/${product.id}/check`);
      expect(first.status).toBe(202);
      expect(first.body).toMatchObject({ accepted: true });

      const second = await api.request<ErrorBody>('POST', `/products/${product.id}/check`);
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('CHECK_ALREADY_RUNNING');
      expect(api.changedetection.triggerCheck).toHaveBeenCalledTimes(1);
    });

    it('rejects a paused product', async () => {
      const product = await seedProduct(ProductStatus.PAUSED);

      const response = await api.request<ErrorBody>('POST', `/products/${product.id}/check`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('PRODUCT_PAUSED');
    });
  });

  describe('POST /products/:id/retry', () => {
    it('recovers a FAILED product', async () => {
      const product = await seedProduct(ProductStatus.FAILED);

      const response = await api.request<{ status: string }>(
        'POST',
        `/products/${product.id}/retry`,
      );

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(ProductStatus.ACTIVE);
    });

    it('rejects a product that is not FAILED', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<ErrorBody>('POST', `/products/${product.id}/retry`);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('PRODUCT_NOT_RETRYABLE');
    });
  });

  describe('DELETE /products/:id', () => {
    it('removes the watch and the product', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request('DELETE', `/products/${product.id}`);

      expect(response.status).toBe(204);
      expect(api.changedetection.deleteWatch).toHaveBeenCalledWith('watch-seed');
      await expect(api.prisma.product.count()).resolves.toBe(0);
    });
  });

  describe('GET /dashboard', () => {
    it('returns counters', async () => {
      await seedProduct(ProductStatus.ACTIVE);

      const response = await api.request<{ totalProducts: number; activeProducts: number }>(
        'GET',
        '/dashboard',
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ totalProducts: 1, activeProducts: 1 });
    });
  });

  describe('rate limiting', () => {
    it('maps the throttler to the documented RATE_LIMITED code', async () => {
      const product = await seedProduct(ProductStatus.ACTIVE);
      let limited: ApiResponse<ErrorBody> | null = null;

      // Limit 60 sn'de 10; cooldown 409'ları limiti tüketmeye devam eder.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const response = await api.request<ErrorBody>('POST', `/products/${product.id}/check`);
        if (response.status === 429) {
          limited = response;
          break;
        }
      }

      expect(limited).not.toBeNull();
      expect(limited?.body.code).toBe('RATE_LIMITED');
      expect(limited?.body.requestId).toEqual(expect.any(String));
    });

    it('does not throttle the webhook endpoint', async () => {
      const statuses = new Set<number>();
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const response = await api.request('POST', '/webhooks/changedetection', {
          body: {},
          headers: { 'x-webhook-secret': 'wrong' },
        });
        statuses.add(response.status);
      }

      // Secret yanlış olduğu için 401 beklenir; 429 asla görülmemeli.
      expect(statuses.has(429)).toBe(false);
    });
  });
});
