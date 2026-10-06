import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAdminCustomers, useDeleteCustomer } from '@/hooks/useCustomers';
import Spinner from '@/components/ui/Spinner';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

export default function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const del = useDeleteCustomer();
  const [toDelete, setToDelete] = useState<any | null>(null);
  const params = {
    page: Number(searchParams.get('page') ?? 1),
    search: searchParams.get('search') || undefined,
  };

  const { data, isLoading } = useAdminCustomers(params);
  const customers = data?.data ?? [];
  const meta = data?.meta;

  function setParam(k: string, v: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set(k, v); else next.delete(k);
    next.set('page', '1');
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Customers</h1>

      <div className="card p-4">
        <input
          type="search"
          placeholder="Search by name or email…"
          className="input w-72"
          defaultValue={params.search}
          onChange={(e) => setParam('search', e.target.value || undefined)}
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : customers.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No customers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Orders</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c: any) => (
                  <tr key={c.id} className="table-row-link">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-gray-500">{c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link to={`/customers/${c.id}`} className="text-primary-700 hover:underline text-xs font-medium">View →</Link>
                      <button
                        onClick={() => setToDelete(c)}
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

        {meta && meta.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">{meta.total} customers</span>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrevPage} onClick={() => setParam('page', String(params.page - 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">← Prev</button>
              <span className="text-xs text-gray-500 flex items-center px-2">{params.page} / {meta.totalPages}</span>
              <button disabled={!meta.hasNextPage} onClick={() => setParam('page', String(params.page + 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
        title="Delete Customer"
        itemLabel={toDelete ? `${toDelete.name}${toDelete.email ? ` (${toDelete.email})` : ''}` : undefined}
        message="This removes the customer account. Their past orders are kept for records. This action cannot be undone."
        loading={del.isPending}
      />
    </div>
  );
}
