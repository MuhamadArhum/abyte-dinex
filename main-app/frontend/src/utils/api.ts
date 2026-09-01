import axios, { AxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Default timeout: 30s for regular requests
// Override per-request: api.get('/reports', { timeout: 120_000 })
const DEFAULT_TIMEOUT = 30_000;

// Extended timeout for heavy operations (reports, exports, backups)
export const HEAVY_TIMEOUT  = 120_000;  // 2 min
export const UPLOAD_TIMEOUT = 180_000;  // 3 min

const api = axios.create({
  baseURL,
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ───────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: 401 handling ───────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl: string = error.config?.url ?? '';
      const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/logout');
      const onLoginPage    = window.location.pathname === '/login';

      if (!isAuthEndpoint && !onLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        localStorage.removeItem('tenantConfig');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Retry helper — for transient network errors ───────────────
export async function apiWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isNetworkError = !axios.isAxiosError(err) || !err.response;
      if (!isNetworkError || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ── Typed convenience helpers ─────────────────────────────────
export function apiGet<T = unknown>(url: string, config?: AxiosRequestConfig) {
  return api.get<T>(url, config).then((r) => r.data);
}

export function apiPost<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return api.post<T>(url, data, config).then((r) => r.data);
}

export function apiPut<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) {
  return api.put<T>(url, data, config).then((r) => r.data);
}

export function apiDelete<T = unknown>(url: string, config?: AxiosRequestConfig) {
  return api.delete<T>(url, config).then((r) => r.data);
}

export default api;
