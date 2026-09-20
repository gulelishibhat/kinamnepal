import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

// Dev: unset → Vite proxy "/api". Production: set VITE_API_BASE_URL to the
// API origin, e.g. http://<eb-host>/api
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // still send cookies when same-origin (dev)
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token (works cross-origin over HTTP — no cross-site cookie needed).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth and send to login (no cookie refresh in cross-site mode).
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
