import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { LoginInput, RegisterCustomerInput } from '@mkelectric/shared';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post('/auth/login', input);
      return data.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Login failed');
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: RegisterCustomerInput) => {
      const { data } = await api.post('/auth/register', input);
      return data.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Registration failed');
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => api.post('/auth/logout').catch(() => undefined),
    onSuccess: () => {
      logout();
      qc.clear();
      navigate('/');
    },
  });
}

// Fetches the current authenticated user (includes emailVerified) for the verify banner.
export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data as { id: string; name: string; email: string; role: string; emailVerified?: boolean };
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });
}

// Resends the email-verification link to the current user.
export function useResendVerification() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/resend-verification');
      return data;
    },
    onSuccess: () => toast.success('Verification email sent. Check your inbox.'),
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Could not resend email'),
  });
}

// Request a password-reset email (customer).
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post('/auth/forgot-password', { email, role: 'customer' });
      return data;
    },
  });
}

// Set a new password using the emailed token (customer).
export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: { token: string; newPassword: string; confirmPassword: string }) => {
      const { data } = await api.post('/auth/reset-password', { ...input, role: 'customer' });
      return data;
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Could not reset password'),
  });
}
