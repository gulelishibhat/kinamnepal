import { useParams, Link } from 'react-router-dom';
import { useSellerOrder } from '@/hooks/useSellerData';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

const STATUS_VARIANT: Record<string, any> = {
  pending_payment: 'yellow', confirmed: 'blue', dispatched: 'purple', delivered: 'green', cancelled: 'red', payment_expired: 'gray',
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useSellerOrder(id!);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-24 text-gray-400">Order not found. <Link to="/orders" className="text-primary-700 underline">Back</Link></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/orders" className="text-sm text-gray-500 hover:text-gray-700">← Orders</Link>
        <h1 className="text-xl font-bold text-gray-900">{order.orderNumber}</h1>
        <Badge variant={STATUS_VARIANT[order.status] ?? 'gray'}>{order.status.replace('_', ' ')}</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200"><h2 className="font-semibold text-gray-900">Your Items in This Order</h2></div>
          <div className="divide-y divide-gray-100">
            {order.items?.map((it: any) => (
              <div key={it.id} className="flex items-center gap-4 px-5 py-4">
                {it.productImage && <img src={it.productImage} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{it.productNameEn}</p>
                  <p className="text-xs text-gray-500">SKU: {it.sku} · ×{it.quantity}</p>
                </div>
                <p className="font-semibold text-sm">Rs. {Number(it.lineTotal).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-200 flex justify-between font-bold text-gray-900">
            <span>Your Subtotal</span>
            <span>Rs. {Number(order.sellerSubtotal).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Order Summary</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">Confirmation number</p>
                <p className="font-mono font-semibold text-gray-900">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Placed</p>
                <p className="text-gray-800">{new Date(order.placedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <Badge variant={STATUS_VARIANT[order.status] ?? 'gray'}>{order.status.replace('_', ' ')}</Badge>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
              Customer contact and delivery details are managed by KinamNepal and are not shared with sellers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
