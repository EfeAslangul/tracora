import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChangeDetectionClientError,
  type ChangeDetectionErrorCode,
} from './changedetection.errors';
import type {
  ChangeDetectionClient,
  CreatedWatch,
  CreateWatchInput,
  UpdateWatchInput,
  WatchSnapshot,
  WatchSummary,
} from './changedetection.types';

interface RawCreatedWatch {
  uuid?: unknown;
}

interface RawWatch {
  url?: unknown;
  title?: unknown;
  fetch_backend?: unknown;
  last_checked?: unknown;
  last_changed?: unknown;
  last_error?: unknown;
  history_n?: unknown;
  restock?: {
    price?: unknown;
    currency?: unknown;
    in_stock?: unknown;
  };
}

type RawWatchList = Record<string, RawWatch>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  fallbackErrorCode?: ChangeDetectionErrorCode;
}

@Injectable()
export class ChangedetectionHttpClient implements ChangeDetectionClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('CHANGEDETECTION_BASE_URL', 'http://localhost:5050')
      .replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('CHANGEDETECTION_API_KEY', '').trim();
    this.timeoutMs = Number(this.configService.get<number>('CHANGEDETECTION_TIMEOUT_MS', 10_000));
  }

  async createWatch(input: CreateWatchInput): Promise<CreatedWatch> {
    const response = await this.request<RawCreatedWatch>('/api/v1/watch', {
      method: 'POST',
      body: this.toWatchPayload(input),
      fallbackErrorCode: 'WATCH_CREATE_FAILED',
    });

    if (typeof response.uuid !== 'string' || response.uuid.length === 0) {
      throw new ChangeDetectionClientError(
        'WATCH_CREATE_FAILED',
        'changedetection.io watch oluşturma cevabı geçersiz.',
        false,
      );
    }

    return { id: response.uuid };
  }

  async updateWatch(id: string, input: UpdateWatchInput): Promise<void> {
    await this.request(`/api/v1/watch/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: this.toWatchPayload(input),
    });
  }

  async deleteWatch(id: string): Promise<void> {
    await this.request(`/api/v1/watch/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async triggerCheck(id: string): Promise<void> {
    await this.request(`/api/v1/watch/${encodeURIComponent(id)}?recheck=1`);
  }

  async getWatch(id: string): Promise<WatchSnapshot> {
    const watch = await this.request<RawWatch>(`/api/v1/watch/${encodeURIComponent(id)}`);
    return this.toWatchSnapshot(id, watch);
  }

  async listWatches(): Promise<WatchSummary[]> {
    const watches = await this.request<RawWatchList>('/api/v1/watch');

    return Object.entries(watches).map(([id, watch]) => {
      const snapshot = this.toWatchSnapshot(id, watch);
      return {
        id: snapshot.id,
        url: snapshot.url,
        title: snapshot.title,
        lastCheckedAt: snapshot.lastCheckedAt,
        lastChangedAt: snapshot.lastChangedAt,
        lastError: snapshot.lastError,
      };
    });
  }

  private toWatchPayload(input: CreateWatchInput | UpdateWatchInput): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (input.url !== undefined) payload.url = input.url;
    if (input.title !== undefined) payload.title = input.title;
    if ('tag' in input && input.tag !== undefined) payload.tag = input.tag;
    if (input.headers !== undefined) payload.headers = input.headers;
    if ('paused' in input && input.paused !== undefined) payload.paused = input.paused;
    if (input.fetchMode !== undefined && input.fetchMode !== 'AUTO') {
      payload.fetch_backend = input.fetchMode === 'BROWSER' ? 'html_webdriver' : 'html_requests';
    }
    if (input.checkIntervalSeconds !== undefined) {
      payload.time_between_check = this.toTimeBetweenCheck(input.checkIntervalSeconds);
      payload.time_between_check_use_default = false;
    }
    if ('processor' in input && input.processor !== undefined) {
      payload.processor = input.processor;
      payload.restock_settings = {
        follow_price_changes: true,
        in_stock_processing: 'all_changes',
      };
    }
    if ('extractTitleAsTitle' in input && input.extractTitleAsTitle !== undefined) {
      payload.extract_title_as_title = input.extractTitleAsTitle;
    }
    if ('notification' in input && input.notification !== undefined) {
      payload.notification_urls = [input.notification.url];
      payload.notification_title = input.notification.title;
      payload.notification_body = input.notification.body;
      payload.notification_format = 'Text';
    }

    return payload;
  }

  private toTimeBetweenCheck(totalSeconds: number): Record<string, number> {
    let remaining = Math.max(0, Math.floor(totalSeconds));
    const weeks = Math.floor(remaining / 604_800);
    remaining %= 604_800;
    const days = Math.floor(remaining / 86_400);
    remaining %= 86_400;
    const hours = Math.floor(remaining / 3_600);
    remaining %= 3_600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return { weeks, days, hours, minutes, seconds };
  }

  private toWatchSnapshot(id: string, watch: RawWatch): WatchSnapshot {
    return {
      id,
      url: typeof watch.url === 'string' ? watch.url : '',
      title: typeof watch.title === 'string' ? watch.title : '',
      fetchMode: watch.fetch_backend === 'html_webdriver' ? 'BROWSER' : 'HTTP',
      lastCheckedAt: this.toDate(watch.last_checked),
      lastChangedAt: this.toDate(watch.last_changed),
      lastError: this.toErrorMessage(watch.last_error),
      historyCount:
        typeof watch.history_n === 'number' && Number.isFinite(watch.history_n)
          ? watch.history_n
          : 0,
      observation: {
        price: this.toStringValue(watch.restock?.price),
        currency: this.toStringValue(watch.restock?.currency)?.toUpperCase() ?? null,
        inStock: typeof watch.restock?.in_stock === 'boolean' ? watch.restock.in_stock : null,
      },
    };
  }

  private toDate(value: unknown): Date | null {
    return typeof value === 'number' && value > 0 ? new Date(value * 1_000) : null;
  }

  private toErrorMessage(value: unknown): string | null {
    if (value === false || value === null || value === undefined || value === '') return null;
    return typeof value === 'string' ? value : 'changedetection.io bilinmeyen bir hata bildirdi.';
  }

  private toStringValue(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
  }

  private async request<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.apiKey) {
      throw new ChangeDetectionClientError(
        'CHANGEDETECTION_NOT_CONFIGURED',
        'CHANGEDETECTION_API_KEY yapılandırılmamış.',
        false,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw this.toHttpError(response.status, options.fallbackErrorCode);
      }

      if (response.status === 204) return undefined as T;

      const body = await response.text();
      if (!body) return undefined as T;

      const contentType = response.headers.get('content-type') ?? '';
      return (contentType.includes('json') ? JSON.parse(body) : body) as T;
    } catch (error) {
      if (error instanceof ChangeDetectionClientError) throw error;

      const timedOut =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError';
      throw new ChangeDetectionClientError(
        'CHANGEDETECTION_UNAVAILABLE',
        timedOut
          ? 'changedetection.io isteği zaman aşımına uğradı.'
          : 'changedetection.io servisine ulaşılamadı.',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private toHttpError(
    status: number,
    fallbackErrorCode: ChangeDetectionErrorCode = 'CHANGEDETECTION_REQUEST_FAILED',
  ): ChangeDetectionClientError {
    if (status === 401 || status === 403) {
      return new ChangeDetectionClientError(
        'CHANGEDETECTION_AUTH_FAILED',
        'changedetection.io kimlik doğrulaması başarısız.',
        false,
        status,
      );
    }
    if (status === 404) {
      return new ChangeDetectionClientError(
        'WATCH_NOT_FOUND',
        'changedetection.io watch bulunamadı.',
        false,
        status,
      );
    }
    if (status === 429) {
      return new ChangeDetectionClientError(
        'RATE_LIMITED',
        'changedetection.io istek sınırı aşıldı.',
        true,
        status,
      );
    }
    if (status >= 500) {
      return new ChangeDetectionClientError(
        'CHANGEDETECTION_UNAVAILABLE',
        'changedetection.io geçici olarak kullanılamıyor.',
        true,
        status,
      );
    }

    return new ChangeDetectionClientError(
      fallbackErrorCode,
      'changedetection.io isteği reddetti.',
      false,
      status,
    );
  }
}
