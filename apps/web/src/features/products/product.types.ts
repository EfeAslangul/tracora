export interface ProductListItem {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FAILED';
}
