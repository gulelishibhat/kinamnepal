import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSellerRegister } from '@/hooks/useSellerAuth';
import type { RegisterSellerInput } from '@mkelectric/shared';

export default function RegisterPage() {
  const register = useSellerRegister();
  const [form, setForm] = useState({
    email: '', password: '', shopName: '', shopDescription: '',
    ownerName: '', phone: '', addressStreet: '', addressCity: '', addressDistrict: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.shopName.trim()) e.shopName = 'Shop name is required';
    if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
    if (!form.email) e.email = 'Email is required';
    if (!form.phone.match(/^(98|97)\d{8}$/)) e.phone = 'Enter a valid Nepali mobile number';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) register.mutate(form as RegisterSellerInput);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.svg" alt="KinamNepal" className="h-14 w-14 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Create Your Shop</h1>
          <p className="text-gray-500 text-sm mt-1">Start selling on KinamNepal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Shop (public)</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
            <input className="input" value={form.shopName} onChange={(e) => setForm((f) => ({ ...f, shopName: e.target.value }))} />
            {errors.shopName && <p className="text-red-500 text-xs mt-1">{errors.shopName}</p>}
            <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Shop Description</label>
            <textarea className="input resize-none" rows={2} value={form.shopDescription} onChange={(e) => setForm((f) => ({ ...f, shopDescription: e.target.value }))} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact (private — hidden from buyers)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                <input className="input" value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} />
                {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="98XXXXXXXX" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <input className="input" placeholder="Street" value={form.addressStreet} onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))} />
              <input className="input" placeholder="City" value={form.addressCity} onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))} />
              <input className="input" placeholder="District" value={form.addressDistrict} onChange={(e) => setForm((f) => ({ ...f, addressDistrict: e.target.value }))} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Login</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
            </div>
          </div>

          <button type="submit" disabled={register.isPending} className="btn-primary w-full py-3 mt-2">
            {register.isPending ? 'Creating shop…' : 'Create Shop'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already a seller?{' '}
          <Link to="/login" className="text-primary-700 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
