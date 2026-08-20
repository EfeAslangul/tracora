import { ProductStatus } from '@prisma/client';
import { ObservationService } from '../src/modules/webhooks/observation.service';
import { DEFAULT_UID, SECOND_UID, createTestApi, type TestApi } from './support/app.factory';

const URL = 'https://shared.example/product';

/**
 * Aynı URL'yi izleyen kullanıcılar tek changedetection.io watch'ını paylaşır.
 * Bu spec paylaşımın üç kritik sonucunu ölçer: watch bir kez açılır, gözlem
 * herkese yazılır, uzak watch ancak son sahip ayrılınca kapanır.
 */
describe('Shared watch fan-out integration', () => {
  let api: TestApi;
  let observations: ObservationService;

  beforeAll(async () => {
    api = await createTestApi();
    observations = api.app.get(ObservationService);
  });
  afterAll(() => api.close());
  beforeEach(async () => {
    await api.reset();
    api.changedetection.createWatch.mockResolvedValue({ id: 'watch-shared' });
    api.changedetection.triggerCheck.mockResolvedValue();
    api.changedetection.deleteWatch.mockResolvedValue();
    api.changedetection.updateWatch.mockResolvedValue();
  });

  async function track(uid: string) {
    const response = await api.request<{ id: string }>('POST', '/products', {
      as: uid,
      body: { url: URL },
    });
    expect(response.status).toBe(201);
    return response.body;
  }

  async function observe(eventId: string, price: string) {
    return observations.process({
      eventId,
      watchId: 'watch-shared',
      observedAt: new Date(),
      price,
      currency: 'TRY',
      inStock: true,
    });
  }

  it('creates the remote watch once for two owners', async () => {
    await track(DEFAULT_UID);
    await track(SECOND_UID);

    expect(api.changedetection.createWatch).toHaveBeenCalledTimes(1);
    await expect(api.prisma.watch.count()).resolves.toBe(1);
    await expect(api.prisma.product.count()).resolves.toBe(2);
  });

  it('writes one observation to every owner’s product', async () => {
    const first = await track(DEFAULT_UID);
    const second = await track(SECOND_UID);
    await api.request('PATCH', '/me', { body: { telegramChatId: '4242' } });
    await api.request('PATCH', '/me', { as: SECOND_UID, body: { telegramChatId: '5353' } });

    await observe('baseline-1', '100.00');
    const result = await observe('drop-1', '80.00');

    expect(result).toEqual({ processed: 2, duplicates: 0 });
    const products = await api.prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
    expect(products.map((product) => product.currentPrice?.toString())).toEqual(['80', '80']);
    await expect(api.prisma.priceSnapshot.count({ where: { productId: first.id } })).resolves.toBe(
      2,
    );
    await expect(api.prisma.priceSnapshot.count({ where: { productId: second.id } })).resolves.toBe(
      2,
    );
    // Aynı olay iki ayrı outbox satırı üretir: her sahip kendi sohbetine alır.
    await expect(api.prisma.notificationDelivery.count()).resolves.toBe(2);
  });

  it('pauses the remote watch only after every owner pauses', async () => {
    const first = await track(DEFAULT_UID);
    const second = await track(SECOND_UID);

    await api.request('PATCH', `/products/${first.id}`, {
      body: { status: ProductStatus.PAUSED },
    });
    expect(api.changedetection.updateWatch).not.toHaveBeenCalled();

    await api.request('PATCH', `/products/${second.id}`, {
      as: SECOND_UID,
      body: { status: ProductStatus.PAUSED },
    });
    expect(api.changedetection.updateWatch).toHaveBeenCalledWith('watch-shared', { paused: true });

    // İlk sahip geri döndüğünde watch yeniden çalışmalı.
    await api.request('PATCH', `/products/${first.id}`, {
      body: { status: ProductStatus.ACTIVE },
    });
    expect(api.changedetection.updateWatch).toHaveBeenLastCalledWith('watch-shared', {
      paused: false,
    });
  });

  it('deletes the remote watch only when the last owner leaves', async () => {
    const first = await track(DEFAULT_UID);
    const second = await track(SECOND_UID);

    await api.request('DELETE', `/products/${first.id}`);
    expect(api.changedetection.deleteWatch).not.toHaveBeenCalled();
    await expect(api.prisma.watch.count()).resolves.toBe(1);

    await api.request('DELETE', `/products/${second.id}`, { as: SECOND_UID });
    expect(api.changedetection.deleteWatch).toHaveBeenCalledWith('watch-shared');
    await expect(api.prisma.watch.count()).resolves.toBe(0);
  });

  it('shares the manual check cooldown between owners', async () => {
    const first = await track(DEFAULT_UID);
    const second = await track(SECOND_UID);
    api.changedetection.triggerCheck.mockClear();
    // Ürün ekleme cooldown'u zaten başlatır; ölçülen şey pencerenin
    // kullanıcılar arasında paylaşılması.
    await api.prisma.watch.updateMany({ data: { lastTriggeredAt: null } });

    const mine = await api.request('POST', `/products/${first.id}/check`);
    const theirs = await api.request<{ code: string }>('POST', `/products/${second.id}/check`, {
      as: SECOND_UID,
    });

    expect(mine.status).toBe(202);
    expect(theirs.status).toBe(409);
    expect(theirs.body.code).toBe('CHECK_ALREADY_RUNNING');
    expect(api.changedetection.triggerCheck).toHaveBeenCalledTimes(1);
  });
});
