import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

// In dev, VITE_API_BASE_URL is unset → uses the Vite proxy at "/api".
// In production, set VITE_API_BASE_URL to the API origin + /api.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send cookies when same-origin (dev)
  headers: { 'Content-Type': 'application/json' },
});

// Attach bearer token for cross-origin auth (works over HTTP, no cross-site cookie).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth. Only redirect to /login for protected areas — guests
// browsing the catalog should not be bounced.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
