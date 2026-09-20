import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLogin } from '@/hooks/useAuth';
import type { LoginInput } from '@mkelectric/shared';

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const [form, setForm] = useState<LoginInput>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<LoginInput>>({});

  function validate() {
    const e: Partial<LoginInput> = {};
    if (!form.email) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    login.mutate(form);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="KinamNepal" className="h-12 w-12 rounded-xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.login.title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.login.email')}</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              autoComplete="email"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">{t('auth.login.password')}</label>
              <Link to="/forgot-password" className="text-xs text-primary-700 hover:underline">
                {t('auth.login.forgotPassword')}
              </Link>
            </div>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <button type="submit" disabled={login.isPending} className="btn-primary w-full py-3">
            {login.isPending ? 'Logging in...' : t('auth.login.submit')}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-primary-700 font-medium hover:underline">
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
