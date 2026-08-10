import type { ProductInput, ProductListItem } from '../products/product.types';

export interface SetupStatus {
  required: boolean;
  completedAt: string | null;
  defaultCheckIntervalSeconds: number;
  telegram: { configured: boolean; status: 'ready' | 'not_configured' | 'degraded' };
}

export interface SetupResult {
  completed: boolean;
  completedAt: string;
  created: ProductListItem[];
  failed: Array<{ url: string; code: string; message: string }>;
}

export interface SetupInput {
  products: ProductInput[];
}
