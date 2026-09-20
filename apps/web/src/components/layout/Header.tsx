import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useProducts';
import type { Locale } from '@mkelectric/shared';

export default function Header() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const totalItems = useCartStore((s) => s.totalItems());
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: categories } = useCategories();

  const [catOpen, setCatOpen] = useState(false);
  const [search, setSearch] = useState('');
  const catRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // On auth pages (login/register) show a minimal header — no search bar or
  // category strip, so the form is clean and nothing overlaps the inputs.
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].some((p) =>
    location.pathname.startsWith(p),
  );

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggleLanguage() {
    i18n.changeLanguage(i18n.language === 'en' ? 'ne' : 'en');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/products?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      {/* Top bar */}
      <div className="bg-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-9 text-xs">
          <span className="hidden sm:block">Buy & sell anything across Nepal</span>
          <div className="flex items-center gap-4 ml-auto">
            <a
              href={import.meta.env.VITE_SELLER_URL ?? '#'}
              className="hover:underline min-h-0 min-w-0"
            >
              Sell on KinamNepal
            </a>
            <button onClick={toggleLanguage} className="min-h-0 min-w-0 hover:underline" aria-label="Toggle language">
              {i18n.language === 'en' ? 'नेपाली' : 'English'}
            </button>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6 h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 min-h-0 min-w-0 shrink-0">
            <img src="/logo.svg" alt="KinamNepal" className="h-9 w-9 rounded-lg" />
            <span className="font-extrabold text-gray-900 text-lg hidden sm:block leading-none">
              Kinam<span className="text-primary-600">Nepal</span>
            </span>
          </Link>

          {/* Search */}
          {!isAuthPage && (
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden sm:flex">
            <div className="relative w-full">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full h-11 pl-4 pr-12 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 h-9 w-9 min-h-0 min-w-0 flex items-center justify-center bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                aria-label={t('search.placeholder')}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto shrink-0">
            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
              aria-label={t('nav.cart')}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.4 5.6M7 13l-1.4 5.6m0 0h11.8M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-primary-600 text-white text-xs rounded-full font-bold">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            {/* Auth */}
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/orders" className="text-sm text-gray-700 font-medium hover:text-primary-600 hidden md:block">
                  {t('nav.orders')}
                </Link>
                <Link to="/profile" className="text-sm text-gray-800 font-semibold hidden sm:block hover:text-primary-600">
                  {user.name}
                </Link>
                <button
                  onClick={() => logout.mutate()}
                  className="text-sm text-gray-500 hover:text-primary-600 transition-colors min-h-0 min-w-0"
                >
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-primary-600 px-2 min-h-0 min-w-0">
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg px-3 py-2 transition-colors min-h-0 min-w-0"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Category bar */}
        {!isAuthPage && (
        <div className="flex items-center gap-1 py-1.5 border-t border-gray-100 overflow-x-auto">
          <div className="relative shrink-0" ref={catRef}>
            <button
              onClick={() => setCatOpen((o) => !o)}
              className="flex items-center gap-2 h-9 px-3 rounded-md bg-primary-50 text-primary-700 font-semibold text-sm hover:bg-primary-100 transition-colors min-h-0 min-w-0 whitespace-nowrap"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              All Categories
              <svg className={`h-4 w-4 transition-transform ${catOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {catOpen && (
              <div className="absolute left-0 top-11 z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg py-2 max-h-[70vh] overflow-y-auto">
                {categories?.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to={`/products?categoryId=${cat.id}`}
                    onClick={() => setCatOpen(false)}
                    className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 min-h-0 min-w-0"
                  >
                    <span>{locale === 'ne' ? cat.nameNe : cat.nameEn}</span>
                    {typeof cat.adCount === 'number' && (
                      <span className="text-xs text-gray-400">{cat.adCount}</span>
                    )}
                  </Link>
                ))}
                {!categories?.length && (
                  <p className="px-4 py-2 text-sm text-gray-400">No categories</p>
                )}
              </div>
            )}
          </div>

          {/* Quick category links */}
          {categories?.slice(0, 8).map((cat: any) => (
            <Link
              key={cat.id}
              to={`/products?categoryId=${cat.id}`}
              className="shrink-0 px-3 h-9 flex items-center text-sm text-gray-600 hover:text-primary-600 rounded-md hover:bg-gray-50 whitespace-nowrap min-h-0 min-w-0"
            >
              {locale === 'ne' ? cat.nameNe : cat.nameEn}
            </Link>
          ))}
        </div>
        )}
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around items-center h-14 px-2">
          <Link to="/" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 min-w-[44px]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {t('nav.home')}
          </Link>
          <Link to="/products" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 min-w-[44px]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {t('nav.categories')}
          </Link>
          <Link to="/cart" className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 min-w-[44px] relative">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.4 5.6M7 13l-1.4 5.6m0 0h11.8M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute top-0 right-2 h-4 w-4 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
            {t('nav.cart')}
          </Link>
          <Link to={user ? '/orders' : '/login'} className="flex flex-col items-center gap-1 text-xs text-gray-500 hover:text-primary-600 min-w-[44px]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {user ? t('nav.profile') : t('nav.login')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
