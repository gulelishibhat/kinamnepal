import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdminSeller, useAdminSellerProducts } from '@/hooks/useSellers';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: seller, isLoading } = useAdminSeller(id!);
  const { data: products, isLoading: loadingProducts } = useAdminSellerProducts(id!);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!seller) return (
    <div className="text-center py-24 text-gray-400">
      Seller not found. <Link to="/sellers" className="text-primary-700 underline">Back</Link>
    </div>
  );

  const address = [seller.addressStreet, seller.addressCity, seller.addressDistrict]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/sellers" className="text-sm text-gray-500 hover:text-gray-700">← Sellers</Link>
        <h1 className="text-xl font-bold text-gray-900">{seller.shopName}</h1>
        <Badge variant={seller.isActive === false ? 'gray' : 'green'}>
          {seller.isActive === false ? 'Inactive' : 'Active'}
        </Badge>
        {seller.emailVerified === false && <Badge variant="yellow">Email unverified</Badge>}
      </div>

      {/* Unique ID */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-gray-500">Unique Seller ID</p>
          <p className="font-mono text-sm text-gray-800">{seller.id}</p>
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(seller.id)}
          className="btn-secondary btn-sm px-3 py-1.5 text-xs"
        >
          Copy ID
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Shop (public) */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Shop (public)</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Shop name: </span><span className="text-gray-800">{seller.shopName}</span></div>
            <div><span className="text-gray-500">Description: </span><span className="text-gray-800">{seller.shopDescription || '—'}</span></div>
            <div><span className="text-gray-500">Joined: </span><span className="text-gray-800">{new Date(seller.createdAt).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Private contact */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Contact (private)</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Owner: </span><span className="text-gray-800">{seller.ownerName || '—'}</span></div>
            <div><span className="text-gray-500">Email: </span><span className="text-gray-800">{seller.email}</span></div>
            <div><span className="text-gray-500">Phone: </span><span className="text-gray-800">{seller.phone || '—'}</span></div>
            <div><span className="text-gray-500">Address: </span><span className="text-gray-800">{address || '—'}</span></div>
          </div>
        </div>

        {/* Stats */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Listings</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Active</span><span className="font-bold">{seller.activeProductCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{seller.productCount}</span></div>
          </div>
        </div>
      </div>

      {/* Inventory list */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Inventory</h2>
          {products && <span className="text-xs text-gray-500">{products.length} items</span>}
        </div>
        {loadingProducts ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : !products?.length ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">This seller has no listings.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => (
                  <tr
                    key={p.id}
                    className="table-row-link cursor-pointer"
                    onClick={() => navigate(`/inventory/${p.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />}
                        <div>
                          <p className="font-medium text-gray-900">{p.nameEn}</p>
                          <p className="text-xs text-gray-400">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.category?.nameEn ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-right font-medium">NPR {Number(p.price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{p.stockQuantity}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'active' ? 'green' : p.status === 'out_of_stock' ? 'red' : 'gray'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/inventory/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary-700 hover:underline text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
