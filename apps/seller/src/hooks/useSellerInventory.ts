import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CreateProductInput, UpdateProductInput, ProductQuery } from '@mkelectric/shared';

// Seller's own products (all statuses).
export function useMyProducts(params: Partial<ProductQuery> = {}) {
  return useQuery({
    queryKey: ['my-products', params],
    queryFn: async () => {
      const { data } = await api.get('/products/seller/mine', { params });
      return data;
    },
  });
}

export function useMyProduct(id: string) {
  return useQuery({
    queryKey: ['my-product', id],
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
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateMyProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data } = await api.post('/products/seller/mine', input);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-products'] }); toast.success('Listing created'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to create listing'),
  });
}

export function useUpdateMyProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const { data } = await api.put(`/products/seller/mine/${id}`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-products'] });
      qc.invalidateQueries({ queryKey: ['my-product', id] });
      toast.success('Listing updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to update listing'),
  });
}

export function useDeleteMyProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/products/seller/mine/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-products'] }); toast.success('Listing removed'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to remove listing'),
  });
}

export function useUploadMyProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post(`/products/seller/mine/${productId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-product', productId] }),
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Upload failed'),
  });
}
