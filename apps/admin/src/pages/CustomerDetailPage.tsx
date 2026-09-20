import { useParams, Link } from 'react-router-dom';
import { useAdminCustomer } from '@/hooks/useCustomers';
import OrderStatusBadge from '@/components/ui/OrderStatusBadge';
import Spinner from '@/components/ui/Spinner';
import type { OrderStatus } from '@mkelectric/shared';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useAdminCustomer(id!);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!customer) return <div className="text-center py-24 text-gray-400">Customer not found. <Link to="/customers" className="text-primary-700 underline">Back</Link></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/customers" className="text-sm text-gray-500 hover:text-gray-700">← Customers</Link>
        <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Contact</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Email: </span><span className="text-gray-800">{customer.email}</span></div>
            <div><span className="text-gray-500">Phone: </span><span className="text-gray-800">{customer.phone ?? '—'}</span></div>
            <div><span className="text-gray-500">Language: </span><span className="text-gray-800">{customer.language?.toUpperCase()}</span></div>
            <div><span className="text-gray-500">Joined: </span><span className="text-gray-800">{new Date(customer.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Addresses */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Saved Addresses</h2>
          {customer.addresses?.length === 0 ? (
            <p className="text-sm text-gray-400">No saved addresses.</p>
          ) : (
            <div className="space-y-2">
              {customer.addresses?.map((addr: any) => (
                <div key={addr.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                  {addr.label && <p className="font-medium text-gray-900 mb-0.5">{addr.label}</p>}
                  <p>{addr.street}, {addr.city}, {addr.district}</p>
                  {addr.isDefault && <span className="text-xs text-primary-600 font-medium">Default</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Order Summary</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Total Orders</span><span className="font-bold">{customer.orders?.length ?? 0}</span></div>
          </div>
        </div>
      </div>

      {/* Order history */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Order History</h2>
        </div>
        {!customer.orders?.length ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No orders placed yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {customer.orders.map((order: any) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 table-row-link"
              >
                <div>
                  <p className="text-sm font-medium text-primary-700">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(order.placedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusBadge status={order.status as OrderStatus} />
                  <span className="font-semibold text-sm">NPR {Number(order.total).toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
