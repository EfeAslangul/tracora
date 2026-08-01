import { Injectable } from '@nestjs/common';
import type {
  ChangeDetectionClient,
  CreatedWatch,
  CreateWatchInput,
  UpdateWatchInput,
  WatchSnapshot,
  WatchSummary,
} from './changedetection.types';

@Injectable()
export class ChangedetectionHttpClient implements ChangeDetectionClient {
  async createWatch(_input: CreateWatchInput): Promise<CreatedWatch> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
  async updateWatch(_id: string, _input: UpdateWatchInput): Promise<void> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
  async deleteWatch(_id: string): Promise<void> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
  async triggerCheck(_id: string): Promise<void> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
  async getWatch(_id: string): Promise<WatchSnapshot> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
  async listWatches(): Promise<WatchSummary[]> {
    throw new Error('ChangeDetection adapter is not implemented until Sprint 1.');
  }
}
