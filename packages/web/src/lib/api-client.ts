import { useAuthStore } from '@/stores/auth.store';

const API_BASE_URL = '/api';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

interface RequestConfig {
  method: string;
  endpoint: string;
  data?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(
    response: Response,
    requestConfig?: RequestConfig
  ): Promise<T> {
    if (!response.ok) {
      // Handle 401 - try to refresh token and retry the request
      if (response.status === 401 && requestConfig) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Retry the original request with new token
          return this.retryRequest<T>(requestConfig);
        }
        useAuthStore.getState().logout();
        throw new Error('Session expired. Please login again.');
      }

      const error: ApiError = await response.json().catch(() => ({
        statusCode: response.status,
        error: response.statusText,
        message: 'An error occurred',
      }));

      throw error;
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text);
  }

  private async tryRefreshToken(): Promise<boolean> {
    // If already refreshing, wait for the existing refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState();

    if (!refreshToken) {
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          logout();
          return false;
        }

        const data = await response.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        logout();
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async retryRequest<T>(config: RequestConfig): Promise<T> {
    const { method, endpoint, data } = config;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    // Don't retry again on 401 to prevent infinite loops
    return this.handleResponse<T>(response);
  }

  async get<T>(endpoint: string): Promise<T> {
    const config: RequestConfig = { method: 'GET', endpoint };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response, config);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const config: RequestConfig = { method: 'POST', endpoint, data };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response, config);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const config: RequestConfig = { method: 'PUT', endpoint, data };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response, config);
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const config: RequestConfig = { method: 'PATCH', endpoint, data };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response, config);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const config: RequestConfig = { method: 'DELETE', endpoint };
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response, config);
  }
}

export const apiClient = new ApiClient();
