import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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

// Admin: permanently remove a customer (soft-delete server-side).
export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/customers/${id}`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
      toast.success('Customer deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to delete customer'),
  });
}
