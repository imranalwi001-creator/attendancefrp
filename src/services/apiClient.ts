// Centralized API Client for HRM Attendance System
export function isCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  const isCapacitorLocalhost = window.location.hostname === 'localhost' && window.location.port !== '5173' && window.location.port !== '3000';
  return isCapacitorNative || isCapacitorScheme || isCapacitorLocalhost;
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api';
  if (isCapacitorApp()) {
    return 'https://fawwazreskiperwira.com/api';
  }
  return '/api';
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutMs = endpoint.includes('/bootstrap') ? 10000 : 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `HTTP error ${res.status}`;
      throw new ApiError(errorMsg, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new ApiError('Koneksi ke backend waktu habis (timeout)', 408);
    }
    throw new ApiError(err.message || 'Gagal terhubung ke server backend', 0);
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
