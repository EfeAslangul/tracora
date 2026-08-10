import { apiClient } from '../../services/api-client';
import type { ProductInput, ProductListItem, ProductListResponse } from './product.types';

export function getProducts() {
  return apiClient.get<ProductListResponse>('/products?page=1&limit=100');
}

export function createProduct(input: ProductInput) {
  return apiClient.post<ProductListItem, ProductInput>('/products', input);
}
