import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyOrders } from '@/hooks/useOrders';
import OrderStatusBadge from '@/components/order/OrderStatusBadge';
import Spinner from '@/components/ui/Spinner';
import type { Order, OrderStatus } from '@mkelectric/shared';

export default function OrdersPage() {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useMyOrders();

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  if (!orders?.length) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 text-lg">{t('order.history.empty')}</p>
        <Link to="/products" className="btn-primary mt-6 px-8 py-3">Shop Now</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('order.history.title')}</h1>
      <div className="space-y-4">
        {orders.map((order: Order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div>
              <p className="font-semibold text-gray-900">{order.orderNumber}</p>
              <p className="text-sm text-gray-500">{new Date(order.placedAt).toLocaleDateString()}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <OrderStatusBadge status={order.status as OrderStatus} />
              <p className="font-bold text-gray-900 text-sm">NPR {Number(order.total).toLocaleString()}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
