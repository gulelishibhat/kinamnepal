import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProductQuery } from '@mkelectric/shared';

export function useProducts(params: Partial<ProductQuery> = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const { data } = await api.get('/products', { params });
      return data;
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get(`/products/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/products/categories');
      return data.data;
    },
    staleTime: 1000 * 60 * 10, // categories change rarely
  });
}
