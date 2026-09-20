import { Link } from 'react-router-dom';
import { useSellerDashboard } from '@/hooks/useSellerData';
import Spinner from '@/components/ui/Spinner';

function Stat({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useSellerDashboard();
  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Active Listings" value={data?.activeListings ?? 0} />
        <Stat title="Low Stock" value={data?.lowStock ?? 0} />
        <Stat title="Today's Orders" value={data?.todayOrders ?? 0} />
        <Stat title="Today's Revenue" value={`Rs. ${Number(data?.todayRevenue ?? 0).toLocaleString('en-IN')}`} />
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Order Items</h2>
          <Link to="/orders" className="text-sm text-primary-700 hover:underline">View all →</Link>
        </div>
        {!data?.recentItems?.length ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No orders yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentItems.map((it: any, i: number) => (
              <Link key={i} to={`/orders/${it.orderId}`} className="flex items-center justify-between px-5 py-3 table-row-link">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{it.productNameEn} <span className="text-gray-400">×{it.quantity}</span></p>
                  <p className="text-xs text-gray-400">{it.orderNumber} · {new Date(it.placedAt).toLocaleDateString()}</p>
                </div>
                <span className="font-semibold text-gray-800 text-sm">Rs. {Number(it.lineTotal).toLocaleString('en-IN')}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
