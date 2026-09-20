import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useSellerProfile } from '@/hooks/useSellerData';
import Spinner from '@/components/ui/Spinner';

export default function ProfilePage() {
  const { data: profile, isLoading } = useSellerProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    shopName: '', shopDescription: '', ownerName: '', phone: '',
    addressStreet: '', addressCity: '', addressDistrict: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        shopName: profile.shopName ?? '', shopDescription: profile.shopDescription ?? '',
        ownerName: profile.ownerName ?? '', phone: profile.phone ?? '',
        addressStreet: profile.addressStreet ?? '', addressCity: profile.addressCity ?? '', addressDistrict: profile.addressDistrict ?? '',
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/sellers/me/profile', form);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-profile'] }); toast.success('Profile updated'); },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Failed to update'),
  });

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  function f(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Shop Profile</h1>

      <div className="card p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Public (shown to buyers)</p>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
          <input className="input" value={form.shopName} onChange={(e) => f('shopName', e.target.value)} />
          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Shop Description</label>
          <textarea className="input resize-none" rows={3} value={form.shopDescription} onChange={(e) => f('shopDescription', e.target.value)} />
        </div>

        <div className="border-t border-gray-200 pt-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Private (hidden from buyers)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
              <input className="input" value={form.ownerName} onChange={(e) => f('ownerName', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => f('phone', e.target.value)} placeholder="98XXXXXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <input className="input" placeholder="Street" value={form.addressStreet} onChange={(e) => f('addressStreet', e.target.value)} />
            <input className="input" placeholder="City" value={form.addressCity} onChange={(e) => f('addressCity', e.target.value)} />
            <input className="input" placeholder="District" value={form.addressDistrict} onChange={(e) => f('addressDistrict', e.target.value)} />
          </div>
          {profile?.email && <p className="text-xs text-gray-400 mt-3">Login email: {profile.email}</p>}
        </div>

        <div className="flex justify-end">
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-primary px-6 py-2">
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
