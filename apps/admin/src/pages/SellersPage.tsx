import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminSellers, useDeleteSeller, type AdminSeller } from '@/hooks/useSellers';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

export default function SellersPage() {
  const navigate = useNavigate();
  const { data: sellers, isLoading } = useAdminSellers();
  const del = useDeleteSeller();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<AdminSeller | null>(null);

  const filtered = (sellers ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.shopName?.toLowerCase().includes(q) ||
      s.ownerName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sellers</h1>
        {sellers && <span className="text-sm text-gray-500">{sellers.length} total</span>}
      </div>

      <div className="card p-4">
        <input
          type="search"
          placeholder="Search by shop, owner, email or ID…"
          className="input w-80"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No sellers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Shop</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Seller ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Listings</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="table-row-link cursor-pointer"
                    onClick={() => navigate(`/sellers/${s.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                          {s.shopName?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-gray-900">{s.shopName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500" title={s.id}>{s.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.ownerName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold">{s.activeProductCount}</span>
                      <span className="text-gray-400"> / {s.productCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Badge variant={s.isActive === false ? 'gray' : 'green'}>
                          {s.isActive === false ? 'Inactive' : 'Active'}
                        </Badge>
                        {s.emailVerified === false && <Badge variant="yellow">Unverified</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to={`/sellers/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-700 hover:underline text-xs font-medium"
                      >
                        View →
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); setToDelete(s); }}
                        className="ml-3 text-red-500 hover:text-red-700 hover:underline text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
        title="Delete Seller"
        itemLabel={toDelete ? `${toDelete.shopName}${toDelete.email ? ` (${toDelete.email})` : ''}` : undefined}
        message="This deactivates the seller account and removes all of their listings from the marketplace. This action cannot be undone."
        loading={del.isPending}
      />
    </div>
  );
}
