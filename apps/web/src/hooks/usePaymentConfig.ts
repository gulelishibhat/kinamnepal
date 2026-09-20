import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaymentConfig } from '@mkelectric/shared';

export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payment-config'],
    queryFn: async () => {
      const { data } = await api.get('/payment/config');
      return data.data as PaymentConfig;
    },
    staleTime: 1000 * 60 * 10,
  });
}
