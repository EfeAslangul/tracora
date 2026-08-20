import { signOut } from 'firebase/auth';
import { currentIdToken, firebaseAuth, isFirebaseConfigured } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<TResponse, TBody>(path: string, body?: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async patch<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return this.request<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await currentIdToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        ...init.headers,
      },
    });
    if (!response.ok) {
      // Token geçersiz/iptal edilmişse yerel oturumu bırakmak, kullanıcıyı
      // sonsuz 401 döngüsünde tutmaktan iyidir.
      if (response.status === 401 && isFirebaseConfigured) {
        await signOut(firebaseAuth()).catch(() => undefined);
      }
      const fallback: ApiErrorBody = {
        code: 'REQUEST_FAILED',
        message: 'İstek şu anda tamamlanamadı.',
        details: {},
        requestId: response.headers.get('x-request-id') ?? '',
      };
      const body = (await response.json().catch(() => fallback)) as ApiErrorBody;
      throw new ApiError(response.status, body);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
