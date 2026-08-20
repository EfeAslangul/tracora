import { apiClient } from '../../services/api-client';
import type {
  ProductDetail,
  ProductInput,
  ProductListItem,
  ProductListResponse,
  ProductUpdateInput,
} from './product.types';

export function getProducts() {
  return apiClient.get<ProductListResponse>('/products?page=1&limit=100');
}

export function createProduct(input: ProductInput) {
  return apiClient.post<ProductListItem, ProductInput>('/products', input);
}

export function getProduct(id: string) {
  return apiClient.get<ProductDetail>(`/products/${id}`);
}

export function updateProduct(id: string, input: ProductUpdateInput) {
  return apiClient.patch<ProductListItem, ProductUpdateInput>(`/products/${id}`, input);
}

export function deleteProduct(id: string) {
  return apiClient.delete<void>(`/products/${id}`);
}

export function checkProduct(id: string) {
  return apiClient.post<{ accepted: boolean; triggeredAt: string }, undefined>(
    `/products/${id}/check`,
  );
}

export function retryProduct(id: string) {
  return apiClient.post<ProductListItem, undefined>(`/products/${id}/retry`);
}
