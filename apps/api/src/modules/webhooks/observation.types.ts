export interface ProductObservation {
  eventId?: string;
  watchId: string;
  observedAt: Date;
  price: string;
  currency: string;
  inStock: boolean | null;
}
