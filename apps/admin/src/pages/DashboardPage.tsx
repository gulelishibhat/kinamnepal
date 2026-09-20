import { Link } from 'react-router-dom';
import { useDashboardSummary } from '@/hooks/useDashboard';
import OrderStatusBadge from '@/components/ui/OrderStatusBadge';
import Spinner from '@/components/ui/Spinner';
import type { OrderStatus } from '@mkelectric/shared';

function StatCard({ title, value, sub, color = 'blue' }: { title: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700', purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <p className={`text-2xl font-bold ${colors[color]?.split(' ')[1] ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Orders"
          value={data?.todayOrders?.count ?? 0}
          sub={`NPR ${Number(data?.todayOrders?.revenue ?? 0).toLocaleString()}`}
          color="blue"
        />
        <StatCard title="Pending Orders" value={data?.pendingOrders ?? 0} color="yellow" />
        <StatCard title="Low Stock Alerts" value={data?.lowStockAlerts ?? 0} color="purple" />
        <StatCard title="New Customers Today" value={data?.newCustomers ?? 0} color="green" />
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/orders" className="text-sm text-primary-700 hover:underline">View all →</Link>
        </div>
        {!data?.recentOrders?.length ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No orders yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentOrders.map((order: any) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3 table-row-link"
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(order.placedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <OrderStatusBadge status={order.status as OrderStatus} />
                  <span className="font-semibold text-gray-800 text-sm">NPR {Number(order.total).toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
