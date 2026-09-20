import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSellerLogin } from '@/hooks/useSellerAuth';

export default function LoginPage() {
  const login = useSellerLogin();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) login.mutate(form);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="KinamNepal" className="h-14 w-14 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Seller Login</h1>
          <p className="text-gray-500 text-sm mt-1">KinamNepal — Seller Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email" autoFocus />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary-700 hover:underline">Forgot password?</Link>
            </div>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="current-password" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <button type="submit" disabled={login.isPending} className="btn-primary w-full py-3">
            {login.isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          New seller?{' '}
          <Link to="/register" className="text-primary-700 font-medium hover:underline">Create a shop</Link>
        </p>
      </div>
    </div>
  );
}
