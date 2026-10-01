// Centralized API Client for HRM Attendance System
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api';

  // Check if running in Capacitor native Android/iOS wrapper
  const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
  const isCapacitorScheme = window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:';
  const isCapacitorLocalhost = window.location.hostname === 'localhost' && window.location.port !== '5173' && window.location.port !== '3000';

  if (isCapacitorNative || isCapacitorScheme || isCapacitorLocalhost) {
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

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `HTTP error ${res.status}`;
      throw new ApiError(errorMsg, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
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
