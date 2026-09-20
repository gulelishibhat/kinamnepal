import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSellerOrders } from '@/hooks/useSellerData';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

const STATUS_VARIANT: Record<string, any> = {
  pending_payment: 'yellow', confirmed: 'blue', dispatched: 'purple', delivered: 'green', cancelled: 'red', payment_expired: 'gray',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSellerOrders({ page });
  const orders = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
      <p className="text-sm text-gray-500">Orders that include your items. You only see your own line items.</p>

      <div className="card overflow-hidden">
        {orders.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No orders for your items yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((o: any) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="block px-5 py-4 table-row-link">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{o.orderNumber}</p>
                    <p className="text-xs text-gray-400">{new Date(o.placedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'gray'}>{o.status.replace('_', ' ')}</Badge>
                    <span className="font-semibold text-gray-800 text-sm">Rs. {Number(o.sellerSubtotal).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {o.items.map((it: any) => `${it.productNameEn} ×${it.quantity}`).join(', ')}
                </p>
              </Link>
            ))}
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">{meta.total} orders</span>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">← Prev</button>
              <span className="text-xs text-gray-500 flex items-center px-2">{page} / {meta.totalPages}</span>
              <button disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
