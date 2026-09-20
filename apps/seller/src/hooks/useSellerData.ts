import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSellerDashboard() {
  return useQuery({
    queryKey: ['seller-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/sellers/me/dashboard');
      return data.data;
    },
    refetchInterval: 60_000,
  });
}

export function useSellerOrders(params: { page?: number } = {}) {
  return useQuery({
    queryKey: ['seller-orders', params],
    queryFn: async () => {
      const { data } = await api.get('/sellers/me/orders', { params });
      return data;
    },
  });
}

export function useSellerOrder(id: string) {
  return useQuery({
    queryKey: ['seller-order', id],
    queryFn: async () => {
      const { data } = await api.get(`/sellers/me/orders/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useSellerProfile() {
  return useQuery({
    queryKey: ['seller-profile'],
    queryFn: async () => {
      const { data } = await api.get('/sellers/me/profile');
      return data.data;
    },
  });
}
