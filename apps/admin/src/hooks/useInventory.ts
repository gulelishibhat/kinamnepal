import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { CreateProductInput, UpdateProductInput, ProductQuery, CreateCategoryInput } from '@mkelectric/shared';

export function useAdminProducts(params: Partial<ProductQuery> = {}) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { ...params, status: undefined } });
      return data;
    },
  });
}

export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: ['admin-product', id],
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
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data } = await api.post('/products', input);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Product created'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to create product'),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      const { data } = await api.put(`/products/${id}`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product', id] });
      toast.success('Product updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to update product'),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); toast.success('Product archived'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to archive product'),
  });
}

export function useUploadProductImage(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post(`/products/${productId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-product', productId] }),
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Upload failed'),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data } = await api.post('/products/categories', input);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Category created'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to create category'),
  });
}
