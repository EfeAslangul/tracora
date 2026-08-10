import type { Prisma, Product, Store } from '@prisma/client';

type ProductWithStore = Product & { store: Store };

export interface ProductListItem {
  id: string;
  name: string | null;
  url: string;
  hostname: string;
  profile: string;
  imageUrl: string | null;
  status: Product['status'];
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string | null;
  targetPrice: number | null;
  inStock: boolean | null;
  notificationsEnabled: boolean;
  lastCheckedAt: Date | null;
  lastSuccessfulCheckAt: Date | null;
  lastError: { code: string; message: string } | null;
  createdAt: Date;
}

const decimal = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : value.toNumber();

export const presentProduct = (product: ProductWithStore): ProductListItem => ({
  id: product.id,
  name: product.name,
  url: product.url,
  hostname: product.store.hostname,
  profile: product.store.profileKey,
  imageUrl: product.imageUrl,
  status: product.status,
  currentPrice: decimal(product.currentPrice),
  previousPrice: decimal(product.previousPrice),
  currency: product.currency,
  targetPrice: decimal(product.targetPrice),
  inStock: product.inStock,
  notificationsEnabled: product.notificationsEnabled,
  lastCheckedAt: product.lastCheckedAt,
  lastSuccessfulCheckAt: product.lastSuccessfulCheckAt,
  lastError:
    product.lastErrorCode && product.lastErrorMessage
      ? { code: product.lastErrorCode, message: product.lastErrorMessage }
      : null,
  createdAt: product.createdAt,
});
