import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { OrderQuery, UpdateOrderStatusInput, ConfirmPaymentInput } from '@mkelectric/shared';

export function useAdminOrders(params: Partial<OrderQuery> = {}) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: async () => {
      const { data } = await api.get('/orders/admin/all', { params });
      return data;
    },
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/admin/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdateOrderStatus(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrderStatusInput) => {
      const { data } = await api.patch(`/orders/${orderId}/status`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', orderId] });
      toast.success('Order status updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to update status'),
  });
}

export function useConfirmPayment(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConfirmPaymentInput) => {
      const { data } = await api.patch(`/orders/${orderId}/confirm-payment`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', orderId] });
      toast.success('Payment confirmed');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to confirm payment'),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Order deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to delete order'),
  });
}
