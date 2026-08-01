const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiClient {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) throw new Error('İstek şu anda tamamlanamadı.');
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
