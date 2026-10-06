import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

// Full seller directory (admin sees private contact/address + listing counts).
export function useAdminSellers() {
  return useQuery({
    queryKey: ['admin-sellers'],
    queryFn: async () => {
      const { data } = await api.get('/sellers/admin/all');
      return data.data as AdminSeller[];
    },
  });
}

// One seller's full profile (private fields visible to admin).
export function useAdminSeller(id: string) {
  return useQuery({
    queryKey: ['admin-seller', id],
    queryFn: async () => {
      const { data } = await api.get(`/sellers/admin/${id}`);
      return data.data as AdminSeller;
    },
    enabled: !!id,
  });
}

// All products belonging to a seller (any status, not just active).
export function useAdminSellerProducts(sellerId: string) {
  return useQuery({
    queryKey: ['admin-seller-products', sellerId],
    queryFn: async () => {
      const { data } = await api.get(`/products/admin/by-seller/${sellerId}`);
      return data.data as any[];
    },
    enabled: !!sellerId,
  });
}

// Admin: remove a seller (deactivates account + soft-deletes their products).
export function useDeleteSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/sellers/admin/${id}`);
      return data.data as { id: string; productsRemoved: number };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['admin-sellers'] });
      toast.success(`Seller deleted${d?.productsRemoved ? ` (${d.productsRemoved} listings removed)` : ''}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to delete seller'),
  });
}

export interface AdminSeller {
  id: string;
  email: string;
  shopName: string;
  shopDescription?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressDistrict?: string | null;
  isApproved?: boolean;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAt: string;
  productCount: number;
  activeProductCount: number;
}
