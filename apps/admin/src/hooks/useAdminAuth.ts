import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useAdminLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await api.post('/auth/admin/login', input);
      return data.data;
    },
    onSuccess: (data) => {
      // Store the bearer token so subsequent requests authenticate cross-origin.
      setAuth(data.user, data.accessToken);
      navigate('/');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Login failed');
    },
  });
}

export function useAdminLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => api.post('/auth/logout').catch(() => undefined),
    onSuccess: () => {
      logout();
      qc.clear();
      navigate('/login');
    },
  });
}
