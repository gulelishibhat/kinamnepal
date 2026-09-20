import { useQuery } from '@tanstack/react-query';
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
