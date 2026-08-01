import { apiClient } from '../../services/api-client';
import type { ProductListItem } from './product.types';

export function getProducts() {
  return apiClient.get<ProductListItem[]>('/products');
}
