import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAdminProducts, useDeleteProduct, useCategories } from '@/hooks/useInventory';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteProduct = useDeleteProduct();
  const { data: categories } = useCategories();

  const params = {
    page: Number(searchParams.get('page') ?? 1),
    search: searchParams.get('search') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
  };

  const { data, isLoading } = useAdminProducts(params);
  const products = data?.data ?? [];
  const meta = data?.meta;

  function setParam(key: string, val: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm px-4 py-2">+ Add Product</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search products…"
          className="input w-60"
          defaultValue={params.search}
          onChange={(e) => setParam('search', e.target.value || undefined)}
        />
        <select className="input w-48" value={params.categoryId ?? ''} onChange={(e) => setParam('categoryId', e.target.value || undefined)}>
          <option value="">All Categories</option>
          {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : products.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Seller</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => {
                  const isLow = p.stockQuantity <= p.lowStockThreshold;
                  return (
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
                      <td className="px-4 py-3">
                        {p.seller ? (
                          <Link
                            to={`/sellers/${p.seller.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary-700 hover:underline"
                          >
                            {p.seller.shopName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.category?.nameEn ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="px-4 py-3 text-right font-medium">NPR {Number(p.price).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.stockQuantity}</span>
                        {isLow && <span className="ml-1 text-xs text-red-500">⚠ Low</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'active' ? 'green' : p.status === 'out_of_stock' ? 'red' : 'gray'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); setEditId(p.id); }} className="text-gray-400 hover:text-primary-600 transition-colors min-h-0 min-w-0 p-1" title="Edit">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }} className="text-gray-400 hover:text-red-500 transition-colors min-h-0 min-w-0 p-1" title="Archive">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">{meta.total} products</span>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrevPage} onClick={() => setParam('page', String(params.page - 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">← Prev</button>
              <span className="text-xs text-gray-500 flex items-center px-2">{params.page} / {meta.totalPages}</span>
              <button disabled={!meta.hasNextPage} onClick={() => setParam('page', String(params.page + 1))} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <ProductFormModal
        open={showCreate || !!editId}
        onClose={() => { setShowCreate(false); setEditId(null); }}
        editId={editId}
      />

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteProduct.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })}
        title="Archive Product"
        message="This product will be archived and hidden from the storefront. Stock data is preserved."
        confirmLabel="Archive"
        danger
        loading={deleteProduct.isPending}
      />
    </div>
  );
}
