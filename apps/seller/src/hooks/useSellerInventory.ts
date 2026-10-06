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

// Flat list of ALL categories (top-level + subcategories). Sellers assign
// products to any of them, so we need the flat list (not the nested tree).
export function useCategories() {
  return useQuery({
    queryKey: ['categories', 'flat'],
    queryFn: async () => {
      const { data } = await api.get('/products/categories', { params: { flat: 'true' } });
      return data.data as Array<{ id: string; nameEn: string; nameNe: string; parentId: string | null; sortOrder: number }>;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// Build an ordered, hierarchical list: each top-level followed by its children,
// with a `depth` and a display label ("Parent → Child") for dropdowns/templates.
export interface CategoryOption { id: string; label: string; nameEn: string; depth: number; isChild: boolean; }
export function toCategoryOptions(
  cats: Array<{ id: string; nameEn: string; parentId: string | null; sortOrder: number }> | undefined,
): CategoryOption[] {
  if (!cats) return [];
  const tops = cats.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  const childrenOf = (id: string) => cats.filter((c) => c.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  const out: CategoryOption[] = [];
  for (const t of tops) {
    out.push({ id: t.id, label: t.nameEn, nameEn: t.nameEn, depth: 0, isChild: false });
    for (const c of childrenOf(t.id)) {
      out.push({ id: c.id, label: `${t.nameEn} → ${c.nameEn}`, nameEn: c.nameEn, depth: 1, isChild: true });
    }
  }
  return out;
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

export interface BulkUploadResult {
  created: number;
  failedCount: number;
  failed: Array<{ row: number; title: string; error: string }>;
}

// Bulk-create products from parsed CSV rows.
export function useBulkUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const { data } = await api.post('/products/seller/bulk', { rows });
      return data.data as BulkUploadResult;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-products'] }); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Bulk upload failed'),
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
