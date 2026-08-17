import type {
  EventLog,
  PriceSnapshot,
  Prisma,
  Product,
  StockSnapshot,
  Store,
  WatchBinding,
  WatchFetchMode,
} from '@prisma/client';

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

export interface PriceHistoryPoint {
  price: number;
  currency: string;
  observedAt: Date;
}

export interface StockHistoryPoint {
  inStock: boolean;
  observedAt: Date;
}

export interface ProductEvent {
  type: string;
  code: string | null;
  message: string;
  createdAt: Date;
}

export interface ProductDetail extends ProductListItem {
  watchId: string | null;
  fetchMode: WatchFetchMode | null;
  priceHistory: PriceHistoryPoint[];
  stockHistory: StockHistoryPoint[];
  recentEvents: ProductEvent[];
}

export const presentProductDetail = (
  product: ProductWithStore,
  priceSnapshots: PriceSnapshot[],
  stockSnapshots: StockSnapshot[],
  events: EventLog[],
  binding: WatchBinding | null,
): ProductDetail => ({
  ...presentProduct(product),
  watchId: binding?.externalWatchId ?? null,
  fetchMode: binding?.fetchMode ?? null,
  priceHistory: priceSnapshots
    .map((snapshot) => ({
      price: snapshot.price.toNumber(),
      currency: snapshot.currency,
      observedAt: snapshot.observedAt,
    }))
    .reverse(),
  stockHistory: stockSnapshots
    .map((snapshot) => ({ inStock: snapshot.inStock, observedAt: snapshot.observedAt }))
    .reverse(),
  recentEvents: events.map((event) => ({
    type: event.type,
    code: event.code,
    message: event.message,
    createdAt: event.createdAt,
  })),
});
