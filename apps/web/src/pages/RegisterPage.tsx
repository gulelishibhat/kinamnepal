import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegister } from '@/hooks/useAuth';
import type { RegisterCustomerInput } from '@mkelectric/shared';

export default function RegisterPage() {
  const { t } = useTranslation();
  const register = useRegister();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email) e.email = 'Email is required';
    if (!form.phone.match(/^(98|97)\d{8}$/)) e.phone = 'Enter a valid Nepali mobile number';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const { confirmPassword: _, ...input } = form;
    register.mutate(input as RegisterCustomerInput);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="KinamNepal" className="h-12 w-12 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.register.title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', label: t('auth.register.name'), type: 'text', autocomplete: 'name' },
            { key: 'email', label: t('auth.register.email'), type: 'email', autocomplete: 'email' },
            { key: 'phone', label: t('auth.register.phone'), type: 'tel', autocomplete: 'tel' },
            { key: 'password', label: t('auth.register.password'), type: 'password', autocomplete: 'new-password' },
            { key: 'confirmPassword', label: t('auth.register.confirmPassword'), type: 'password', autocomplete: 'new-password' },
          ].map(({ key, label, type, autocomplete }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                className="input"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                autoComplete={autocomplete}
                placeholder={key === 'phone' ? '98XXXXXXXX' : undefined}
              />
              {errors[key] && <p className="text-red-500 text-xs mt-1">{errors[key]}</p>}
            </div>
          ))}

          <button type="submit" disabled={register.isPending} className="btn-primary w-full py-3 mt-2">
            {register.isPending ? 'Creating account...' : t('auth.register.submit')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('auth.register.hasAccount')}{' '}
          <Link to="/login" className="text-primary-700 font-medium hover:underline">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
