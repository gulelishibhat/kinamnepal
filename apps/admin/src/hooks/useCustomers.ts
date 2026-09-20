import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerQuery } from '@mkelectric/shared';

export function useAdminCustomers(params: Partial<CustomerQuery> = {}) {
  return useQuery({
    queryKey: ['admin-customers', params],
    queryFn: async () => {
      const { data } = await api.get('/customers', { params });
      return data;
    },
  });
}

export function useAdminCustomer(id: string) {
  return useQuery({
    queryKey: ['admin-customer', id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}
