import type { ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useSellerLogout } from '@/hooks/useSellerAuth';
import VerifyBanner from '@/components/VerifyBanner';

const links = [
  { to: '/', label: 'Dashboard', short: 'Home', exact: true, icon: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  ) },
  { to: '/inventory', label: 'My Inventory', short: 'Inventory', icon: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  ) },
  { to: '/orders', label: 'My Orders', short: 'Orders', icon: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  ) },
  { to: '/profile', label: 'Shop Profile', short: 'Profile', icon: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  ) },
];

export default function SellerLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useSellerLogout();

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 bg-gray-900 min-h-screen shrink-0">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
          <img src="/logo.svg" alt="KinamNepal" className="h-8 w-8 rounded-lg" />
          <div>
            <p className="text-white font-semibold text-sm leading-none">KinamNepal</p>
            <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[140px]">Seller Portal</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(({ to, label, exact, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={exact ?? false}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-0 min-w-0 ${
                  isActive ? 'bg-primary-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-700">
          <button
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors min-h-0 min-w-0 w-full"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — shows on all sizes; on mobile carries the logo */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between">
          {/* Mobile: logo + store name */}
          <Link to="/" className="flex items-center gap-2 md:hidden min-h-0 min-w-0">
            <img src="/logo.svg" alt="KinamNepal" className="h-7 w-7 rounded-lg" />
            <span className="font-bold text-gray-900 text-sm">KinamNepal <span className="text-primary-600">Seller</span></span>
          </Link>
          {/* Desktop: page label */}
          <h1 className="hidden md:block text-base font-semibold text-gray-800">KinamNepal — Seller</h1>
          <span className="text-sm text-gray-500 truncate max-w-[140px]">{user?.name}</span>
        </header>

        <VerifyBanner />

        {/* Extra bottom padding on mobile so content isn't hidden by bottom nav */}
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200">
        <div className="flex justify-around items-center h-14">
          {links.map(({ to, short, exact, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={exact ?? false}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 text-[11px] font-medium min-w-[44px] min-h-[44px] justify-center transition-colors ${
                  isActive ? 'text-primary-700' : 'text-gray-500 hover:text-primary-700'
                }`
              }
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
              {short}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
