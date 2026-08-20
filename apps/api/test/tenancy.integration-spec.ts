import { ProductStatus } from '@prisma/client';
import { DEFAULT_UID, SECOND_UID, createTestApi, type TestApi } from './support/app.factory';

interface ErrorBody {
  code: string;
  message: string;
}

interface ProductList {
  items: Array<{ id: string; url: string }>;
  pagination: { total: number };
}

/**
 * Kiracı izolasyonunun sözleşmesi: başkasının ürünü "yasak" değil "yok"
 * görünür; 403 dönmek kaynağın varlığını sızdırırdı.
 */
describe('Multi-tenancy integration', () => {
  let api: TestApi;

  beforeAll(async () => {
    api = await createTestApi();
  });
  afterAll(() => api.close());
  beforeEach(async () => {
    await api.reset();
    api.changedetection.createWatch.mockResolvedValue({ id: 'watch-a' });
    api.changedetection.triggerCheck.mockResolvedValue();
    api.changedetection.deleteWatch.mockResolvedValue();
    api.changedetection.updateWatch.mockResolvedValue();
  });

  async function productOf(uid: string, host: string) {
    const response = await api.request<{ id: string }>('POST', '/products', {
      as: uid,
      body: { url: `https://${host}/product` },
    });
    expect(response.status).toBe(201);
    return response.body;
  }

  it('provisions a local user row on the first authenticated request', async () => {
    await api.request('GET', '/products', { as: 'brand-new-user' });

    const user = await api.prisma.user.findUniqueOrThrow({
      where: { firebaseUid: 'brand-new-user' },
    });
    expect(user.email).toBe('brand-new-user@example.com');
    expect(user.lastSeenAt).not.toBeNull();
  });

  it('lists only the products the caller owns', async () => {
    api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-a' });
    await productOf(DEFAULT_UID, 'a.example');
    api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-b' });
    await productOf(SECOND_UID, 'b.example');

    const mine = await api.request<ProductList>('GET', '/products');
    const theirs = await api.request<ProductList>('GET', '/products', { as: SECOND_UID });

    expect(mine.body.items.map((item) => item.url)).toEqual(['https://a.example/product']);
    expect(theirs.body.items.map((item) => item.url)).toEqual(['https://b.example/product']);
  });

  it('hides another user’s product behind 404 on every single-product route', async () => {
    const product = await productOf(DEFAULT_UID, 'a.example');

    const detail = await api.request<ErrorBody>('GET', `/products/${product.id}`, {
      as: SECOND_UID,
    });
    const patch = await api.request<ErrorBody>('PATCH', `/products/${product.id}`, {
      as: SECOND_UID,
      body: { targetPrice: 10 },
    });
    const check = await api.request<ErrorBody>('POST', `/products/${product.id}/check`, {
      as: SECOND_UID,
    });
    const remove = await api.request<ErrorBody>('DELETE', `/products/${product.id}`, {
      as: SECOND_UID,
    });

    for (const response of [detail, patch, check, remove]) {
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    }
    await expect(api.prisma.product.count()).resolves.toBe(1);
  });

  it('counts only the caller’s products on the dashboard', async () => {
    api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-a' });
    await productOf(DEFAULT_UID, 'a.example');
    api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-b' });
    await productOf(SECOND_UID, 'b.example');

    const dashboard = await api.request<{ totalProducts: number; activeProducts: number }>(
      'GET',
      '/dashboard',
    );

    expect(dashboard.body).toMatchObject({ totalProducts: 1, activeProducts: 1 });
  });

  it('keeps onboarding state per user', async () => {
    const setup = await api.request<{ completed: boolean }>('POST', '/setup', {
      body: { products: [{ url: 'https://a.example/product' }] },
    });
    expect(setup.status).toBe(201);

    const mine = await api.request<{ required: boolean }>('GET', '/setup/status');
    const theirs = await api.request<{ required: boolean }>('GET', '/setup/status', {
      as: SECOND_UID,
    });

    expect(mine.body.required).toBe(false);
    expect(theirs.body.required).toBe(true);
  });

  it('lets the same url be tracked once per user', async () => {
    await productOf(DEFAULT_UID, 'shared.example');
    const second = await productOf(SECOND_UID, 'shared.example');

    expect(second.id).toBeDefined();
    const duplicate = await api.request<ErrorBody>('POST', '/products', {
      as: SECOND_UID,
      body: { url: 'https://shared.example/product' },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('PRODUCT_ALREADY_EXISTS');
  });

  describe('/me', () => {
    it('returns the profile without leaking the raw telegram chat id', async () => {
      await api.request('PATCH', '/me', { body: { telegramChatId: '4242' } });

      const response = await api.request<{
        email: string;
        telegram: { configured: boolean };
      }>('GET', '/me');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(`${DEFAULT_UID}@example.com`);
      expect(response.body.telegram).toEqual({ configured: true });
      expect(response.body).not.toHaveProperty('telegramChatId');
    });

    it('rejects a telegram chat id that is not numeric', async () => {
      const response = await api.request<ErrorBody>('PATCH', '/me', {
        body: { telegramChatId: 'not-a-chat' },
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });

    it('deletes the account together with its products and watches', async () => {
      await productOf(DEFAULT_UID, 'a.example');

      const response = await api.request('DELETE', '/me');

      expect(response.status).toBe(204);
      expect(api.changedetection.deleteWatch).toHaveBeenCalledWith('watch-a');
      await expect(api.prisma.product.count()).resolves.toBe(0);
      await expect(api.prisma.watch.count()).resolves.toBe(0);
      await expect(api.prisma.user.count({ where: { firebaseUid: DEFAULT_UID } })).resolves.toBe(0);
    });

    it('does not touch another user’s products when an account is deleted', async () => {
      api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-a' });
      await productOf(DEFAULT_UID, 'a.example');
      api.changedetection.createWatch.mockResolvedValueOnce({ id: 'watch-b' });
      const survivor = await productOf(SECOND_UID, 'b.example');

      await api.request('DELETE', '/me');

      const remaining = await api.prisma.product.findMany();
      expect(remaining.map((product) => product.id)).toEqual([survivor.id]);
      expect(remaining[0].status).toBe(ProductStatus.ACTIVE);
    });
  });
});
