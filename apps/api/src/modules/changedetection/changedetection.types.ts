export const CHANGEDETECTION_CLIENT = Symbol('CHANGEDETECTION_CLIENT');

export interface CreateWatchInput {
  url: string;
}

export interface CreatedWatch {
  id: string;
}

export interface UpdateWatchInput {
  url?: string;
}

export interface WatchSnapshot {
  id: string;
}

export interface WatchSummary {
  id: string;
}

export interface ChangeDetectionClient {
  createWatch(input: CreateWatchInput): Promise<CreatedWatch>;
  updateWatch(id: string, input: UpdateWatchInput): Promise<void>;
  deleteWatch(id: string): Promise<void>;
  triggerCheck(id: string): Promise<void>;
  getWatch(id: string): Promise<WatchSnapshot>;
  listWatches(): Promise<WatchSummary[]>;
}
