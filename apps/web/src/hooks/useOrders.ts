import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { CheckoutInput, GuestCheckoutInput } from '@mkelectric/shared';
import { useCartStore } from '@/store/cart.store';

export type PlaceOrderPayload = (CheckoutInput | GuestCheckoutInput) & {
  items: { productId: string; quantity: number }[];
};

export function usePlaceOrder() {
  const clearCart = useCartStore((s) => s.clearCart);
  return useMutation({
    mutationFn: async (payload: PlaceOrderPayload) => {
      const { data } = await api.post('/orders', payload);
      return data.data as {
        orderId: string;
        orderNumber: string;
        total: number;
        paymentType: 'online' | 'cod';
        status: string;
      };
    },
    onSuccess: () => {
      clearCart();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Failed to place order');
    },
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders/my');
      return data.data;
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useTrackOrder() {
  return useMutation({
    mutationFn: async (params: { orderNumber: string; phone: string }) => {
      const { data } = await api.get('/orders/track', { params });
      return data.data;
    },
  });
}
