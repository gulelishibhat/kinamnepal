import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAdminOrders, useDeleteOrder } from '@/hooks/useOrders';
import OrderStatusBadge from '@/components/ui/OrderStatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import type { OrderStatus } from '@mkelectric/shared';

const STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteOrder = useDeleteOrder();

  const params = {
    page: Number(searchParams.get('page') ?? 1),
    status: (searchParams.get('status') as OrderStatus) || undefined,
    search: searchParams.get('search') || undefined,
  };

  const { data, isLoading } = useAdminOrders(params);
  const orders = data?.data ?? [];
  const meta = data?.meta;

  function setParam(key: string, val: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Orders</h1>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search order # or customer…"
          className="input w-60"
          defaultValue={params.search}
          onChange={(e) => setParam('search', e.target.value || undefined)}
        />
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setParam('status', s.value || undefined)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-0 min-w-0 ${
                (params.status ?? '') === s.value
                  ? 'bg-primary-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Order #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order: any) => {
                  const customerName = order.customer?.name ?? order.guestName ?? 'Guest';
                  return (
                    <tr key={order.id} className="table-row-link">
                      <td className="px-4 py-3">
                        <Link to={`/orders/${order.id}`} className="font-medium text-primary-700 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{customerName}</td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status as OrderStatus} /></td>
                      <td className="px-4 py-3 text-gray-500">{new Date(order.placedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">NPR {Number(order.total).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(order.id); }}
                          className="text-gray-400 hover:text-red-500 transition-colors min-h-0 min-w-0 p-1"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">{meta.total} total</span>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrevPage} onClick={() => setParam('page', String(params.page - 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">← Prev</button>
              <span className="text-xs text-gray-500 flex items-center px-2">{params.page} / {meta.totalPages}</span>
              <button disabled={!meta.hasNextPage} onClick={() => setParam('page', String(params.page + 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteOrder.mutate(deleteId, { onSuccess: () => setDeleteId(null) }); }}
        title="Delete Order"
        message="Are you sure you want to delete this order? It will be archived and hidden from the default list."
        confirmLabel="Delete"
        danger
        loading={deleteOrder.isPending}
      />
    </div>
  );
}
