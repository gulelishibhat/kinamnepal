import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { useOrderSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/auth.store';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sseStatus = useOrderSSE(isAuthenticated);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-800">KinamNepal Admin</h1>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${sseStatus === 'connected' ? 'bg-green-500' : sseStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">
              {sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
