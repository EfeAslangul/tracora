import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus, StoreProfileStatus } from '@prisma/client';
import { ChangeDetectionClientError } from '../changedetection/changedetection.errors';
import type { ChangeDetectionClient } from '../changedetection/changedetection.types';
import type { ChangedetectionWatchConfigService } from '../changedetection/changedetection-watch-config.service';
import type { PrismaService } from '../database/prisma.service';
import type { SiteProfileRegistry } from '../sites/site-profile.registry';
import type { UrlSafetyService } from '../sites/url-safety.service';
import { ProductsService } from './products.service';

const now = new Date('2026-08-10T12:00:00Z');
const store = {
  id: 'store-1',
  hostname: 'shop.example',
  name: 'shop.example',
  profileKey: 'generic',
  profileVersion: 1,
  profileStatus: StoreProfileStatus.GENERIC,
  active: true,
  createdAt: now,
  updatedAt: now,
};
const pendingProduct = {
  id: 'product-1',
  storeId: store.id,
  name: null,
  url: 'https://shop.example/product',
  normalizedUrl: 'https://shop.example/product',
  imageUrl: null,
  currentPrice: null,
  previousPrice: null,
  currency: null,
  targetPrice: null,
  inStock: null,
  notificationsEnabled: true,
  status: ProductStatus.PENDING,
  lastCheckedAt: null,
  lastSuccessfulCheckAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: now,
  updatedAt: now,
};

describe('ProductsService', () => {
  const prisma = {
    store: { upsert: jest.fn() },
    product: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    priceSnapshot: { findMany: jest.fn() },
    stockSnapshot: { findMany: jest.fn() },
    eventLog: { findMany: jest.fn() },
    watchBinding: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const urlSafety = { validateAndNormalize: jest.fn() };
  const profiles = { resolve: jest.fn() };
  const watchConfig = { createInput: jest.fn() };
  const changedetection: jest.Mocked<ChangeDetectionClient> = {
    createWatch: jest.fn(),
    updateWatch: jest.fn(),
    deleteWatch: jest.fn(),
    triggerCheck: jest.fn(),
    getWatch: jest.fn(),
    listWatches: jest.fn(),
  };

  const service = new ProductsService(
    prisma as unknown as PrismaService,
    urlSafety as unknown as UrlSafetyService,
    profiles as unknown as SiteProfileRegistry,
    watchConfig as unknown as ChangedetectionWatchConfigService,
    new ConfigService(),
    changedetection,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    urlSafety.validateAndNormalize.mockResolvedValue(new URL(pendingProduct.url));
    profiles.resolve.mockReturnValue({
      key: 'generic',
      version: 1,
      hostnames: ['*'],
      priority: 0,
      fetchMode: 'AUTO',
      normalizeUrl: (url: URL) => url,
    });
    watchConfig.createInput.mockReturnValue({ url: pendingProduct.url, fetchMode: 'HTTP' });
    prisma.store.upsert.mockResolvedValue(store);
    prisma.product.create.mockResolvedValue(pendingProduct);
    prisma.watchBinding.findUnique.mockResolvedValue(null);
    prisma.watchBinding.create.mockResolvedValue({ id: 'binding-1' });
    prisma.product.update.mockResolvedValue({
      ...pendingProduct,
      status: ProductStatus.ACTIVE,
      store,
    });
    changedetection.createWatch.mockResolvedValue({ id: 'watch-1' });
    changedetection.triggerCheck.mockResolvedValue();
    changedetection.deleteWatch.mockResolvedValue();
  });

  it('persists the binding before triggering the initial check', async () => {
    await expect(
      service.create({ url: pendingProduct.url, notificationsEnabled: true }),
    ).resolves.toMatchObject({ id: pendingProduct.id, status: ProductStatus.ACTIVE });

    expect(changedetection.createWatch).toHaveBeenCalledWith(
      expect.objectContaining({ fetchMode: 'HTTP' }),
    );
    expect(prisma.watchBinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalWatchId: 'watch-1',
          requestedFetchMode: 'AUTO',
          fetchMode: 'HTTP',
        }),
      }),
    );
    expect(prisma.watchBinding.create.mock.invocationCallOrder[0]).toBeLessThan(
      changedetection.triggerCheck.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it('deletes an external watch when binding persistence fails', async () => {
    prisma.watchBinding.create.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.create({ url: pendingProduct.url, notificationsEnabled: true }),
    ).rejects.toMatchObject({ code: 'WATCH_CREATE_FAILED' });

    expect(changedetection.deleteWatch).toHaveBeenCalledWith('watch-1');
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: pendingProduct.id },
        data: expect.objectContaining({ status: ProductStatus.FAILED }),
      }),
    );
  });

  describe('detail', () => {
    it('returns histories oldest-first and events newest-first', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.ACTIVE,
        store,
        watchBinding: { externalWatchId: 'watch-1', fetchMode: 'HTTP' },
      });
      prisma.$transaction.mockResolvedValue([
        [
          { price: new Prisma.Decimal(90), currency: 'TRY', observedAt: new Date('2026-08-10') },
          { price: new Prisma.Decimal(100), currency: 'TRY', observedAt: new Date('2026-08-09') },
        ],
        [{ inStock: true, observedAt: new Date('2026-08-10') }],
        [{ type: 'EXTRACTION_ERROR', code: 'X', message: 'm', createdAt: new Date('2026-08-10') }],
      ]);

      const detail = await service.detail(pendingProduct.id);

      expect(detail.watchId).toBe('watch-1');
      expect(detail.priceHistory.map((point) => point.price)).toEqual([100, 90]);
      expect(detail.recentEvents).toHaveLength(1);
    });

    it('throws PRODUCT_NOT_FOUND for an unknown id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.detail(pendingProduct.id)).rejects.toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.ACTIVE,
        store,
        watchBinding: { id: 'binding-1', externalWatchId: 'watch-1' },
      });
    });

    it('pauses the remote watch before writing the local status', async () => {
      await service.update(pendingProduct.id, { status: ProductStatus.PAUSED });

      expect(changedetection.updateWatch).toHaveBeenCalledWith('watch-1', { paused: true });
      expect(changedetection.updateWatch.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.product.update.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('leaves the local status untouched when the remote pause fails', async () => {
      changedetection.updateWatch.mockRejectedValueOnce(new Error('unavailable'));

      await expect(
        service.update(pendingProduct.id, { status: ProductStatus.PAUSED }),
      ).rejects.toMatchObject({ code: 'CHANGEDETECTION_UNAVAILABLE' });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('does not call changedetection for field-only updates', async () => {
      await service.update(pendingProduct.id, { targetPrice: 1799.9 });

      expect(changedetection.updateWatch).not.toHaveBeenCalled();
    });

    it('rejects an empty body', async () => {
      await expect(service.update(pendingProduct.id, {})).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        store,
        watchBinding: { id: 'binding-1', externalWatchId: 'watch-1' },
      });
    });

    it('deletes the remote watch before the database row', async () => {
      await service.remove(pendingProduct.id);

      expect(changedetection.deleteWatch).toHaveBeenCalledWith('watch-1');
      expect(changedetection.deleteWatch.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.product.delete.mock.invocationCallOrder[0] ?? Infinity,
      );
    });

    it('treats an already-missing watch as success', async () => {
      changedetection.deleteWatch.mockRejectedValueOnce(
        new ChangeDetectionClientError('WATCH_NOT_FOUND', 'yok', false, 404),
      );

      await expect(service.remove(pendingProduct.id)).resolves.toBeUndefined();
      expect(prisma.product.delete).toHaveBeenCalled();
    });

    it('keeps the database row when the remote delete fails', async () => {
      changedetection.deleteWatch.mockRejectedValueOnce(
        new ChangeDetectionClientError('CHANGEDETECTION_UNAVAILABLE', 'hata', true, 502),
      );

      await expect(service.remove(pendingProduct.id)).rejects.toMatchObject({
        code: 'CHANGEDETECTION_UNAVAILABLE',
      });
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });
  });

  describe('check', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.ACTIVE,
        store,
        watchBinding: { id: 'binding-1', externalWatchId: 'watch-1' },
      });
      prisma.watchBinding.updateMany.mockResolvedValue({ count: 1 });
    });

    it('triggers a check when the cooldown has elapsed', async () => {
      await expect(service.check(pendingProduct.id)).resolves.toMatchObject({ accepted: true });
      expect(changedetection.triggerCheck).toHaveBeenCalledWith('watch-1');
    });

    it('throws CHECK_ALREADY_RUNNING when the cooldown claim loses', async () => {
      prisma.watchBinding.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.check(pendingProduct.id)).rejects.toMatchObject({
        code: 'CHECK_ALREADY_RUNNING',
      });
      expect(changedetection.triggerCheck).not.toHaveBeenCalled();
    });

    it('does not fail the product when the trigger call fails', async () => {
      changedetection.triggerCheck.mockRejectedValueOnce(new Error('unavailable'));

      await expect(service.check(pendingProduct.id)).rejects.toMatchObject({
        code: 'CHANGEDETECTION_UNAVAILABLE',
      });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('rejects a paused product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.PAUSED,
        store,
        watchBinding: { id: 'binding-1', externalWatchId: 'watch-1' },
      });

      await expect(service.check(pendingProduct.id)).rejects.toMatchObject({
        code: 'PRODUCT_PAUSED',
      });
    });
  });

  describe('retry', () => {
    it('reuses an existing binding', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.FAILED,
        store,
        watchBinding: { id: 'binding-1', externalWatchId: 'watch-1' },
      });

      await expect(service.retry(pendingProduct.id)).resolves.toMatchObject({
        status: ProductStatus.ACTIVE,
      });
      expect(changedetection.createWatch).not.toHaveBeenCalled();
      expect(changedetection.triggerCheck).toHaveBeenCalledWith('watch-1');
    });

    it('provisions a new watch without re-validating the URL', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.FAILED,
        store,
        watchBinding: null,
      });

      await service.retry(pendingProduct.id);

      expect(urlSafety.validateAndNormalize).not.toHaveBeenCalled();
      expect(changedetection.createWatch).toHaveBeenCalled();
    });

    it('rejects a product that is not FAILED', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...pendingProduct,
        status: ProductStatus.ACTIVE,
        store,
        watchBinding: null,
      });

      await expect(service.retry(pendingProduct.id)).rejects.toMatchObject({
        code: 'PRODUCT_NOT_RETRYABLE',
      });
    });
  });
});
