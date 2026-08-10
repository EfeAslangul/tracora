import { ProductStatus, StoreProfileStatus } from '@prisma/client';
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
    product: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    watchBinding: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
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
});
