export interface ProductListItem {
  id: string;
  name: string | null;
  url: string;
  hostname: string;
  profile: string;
  imageUrl: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FAILED';
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string | null;
  targetPrice: number | null;
  inStock: boolean | null;
  notificationsEnabled: boolean;
  lastCheckedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  lastError: { code: string; message: string } | null;
  createdAt: string;
}

export interface ProductInput {
  url: string;
  targetPrice?: number;
  notificationsEnabled: boolean;
}

export interface ProductListResponse {
  items: ProductListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PriceHistoryPoint {
  price: number;
  currency: string;
  observedAt: string;
}

export interface StockHistoryPoint {
  inStock: boolean;
  observedAt: string;
}

export interface ProductEvent {
  type: string;
  code: string | null;
  message: string;
  createdAt: string;
}

export interface ProductDetail extends ProductListItem {
  watchId: string | null;
  fetchMode: string | null;
  priceHistory: PriceHistoryPoint[];
  stockHistory: StockHistoryPoint[];
  recentEvents: ProductEvent[];
}

export interface ProductUpdateInput {
  targetPrice?: number;
  notificationsEnabled?: boolean;
  status?: 'ACTIVE' | 'PAUSED';
}
