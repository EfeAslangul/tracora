export const CHANGEDETECTION_CLIENT = Symbol('CHANGEDETECTION_CLIENT');

export type WatchFetchMode = 'AUTO' | 'HTTP' | 'BROWSER';

export interface CreateWatchInput {
  url: string;
  title?: string;
  tag?: string;
  fetchMode?: WatchFetchMode;
  checkIntervalSeconds?: number;
  headers?: Record<string, string>;
  processor?: 'restock_diff';
  extractTitleAsTitle?: boolean;
  notification?: {
    url: string;
    title: string;
    body: string;
  };
}

export interface CreatedWatch {
  id: string;
}

export interface UpdateWatchInput {
  url?: string;
  paused?: boolean;
  title?: string;
  fetchMode?: WatchFetchMode;
  checkIntervalSeconds?: number;
  headers?: Record<string, string>;
}

export interface WatchSnapshot {
  id: string;
  url: string;
  title: string;
  fetchMode: Exclude<WatchFetchMode, 'AUTO'>;
  lastCheckedAt: Date | null;
  lastChangedAt: Date | null;
  lastError: string | null;
  historyCount: number;
  observation: {
    price: string | null;
    currency: string | null;
    inStock: boolean | null;
  };
}

export type WatchSummary = Omit<WatchSnapshot, 'fetchMode' | 'historyCount' | 'observation'>;

export interface ChangeDetectionClient {
  createWatch(input: CreateWatchInput): Promise<CreatedWatch>;
  updateWatch(id: string, input: UpdateWatchInput): Promise<void>;
  deleteWatch(id: string): Promise<void>;
  triggerCheck(id: string): Promise<void>;
  getWatch(id: string): Promise<WatchSnapshot>;
  listWatches(): Promise<WatchSummary[]>;
}
