import type { WatchFetchMode } from '../changedetection/changedetection.types';

export interface SiteProfile {
  key: string;
  version: number;
  hostnames: string[] | ['*'];
  priority: number;
  fetchMode: WatchFetchMode;
  productNameSelector?: string;
  priceSelector?: string;
  stockSelector?: string;
  imageSelector?: string;
  waitSeconds?: number;
  requestHeaders?: Record<string, string>;
  normalizeUrl(url: URL): URL;
}
