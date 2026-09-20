import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { RegisterSellerInput, SellerLoginInput } from '@mkelectric/shared';

export function useSellerLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: SellerLoginInput) => {
      const { data } = await api.post('/auth/seller/login', input);
      return data.data;
    },
    onSuccess: (data) => { setAuth(data.user, data.accessToken); navigate('/'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Login failed'),
  });
}

export function useSellerRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: RegisterSellerInput) => {
      const { data } = await api.post('/auth/seller/register', input);
      return data.data;
    },
    onSuccess: (data) => { setAuth(data.user, data.accessToken); navigate('/'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Registration failed'),
  });
}

export function useSellerLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => api.post('/auth/logout').catch(() => undefined),
    onSuccess: () => { logout(); qc.clear(); navigate('/login'); },
  });
}

// Request a password-reset email (seller).
export function useSellerForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post('/auth/forgot-password', { email, role: 'seller' });
      return data;
    },
  });
}

// Set a new password using the emailed token (seller).
export function useSellerResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; newPassword: string; confirmPassword: string }) => {
      const { data } = await api.post('/auth/reset-password', { ...input, role: 'seller' });
      return data;
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Could not reset password'),
  });
}
