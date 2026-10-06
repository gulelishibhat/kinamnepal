import { useState } from 'react';
import toast from 'react-hot-toast';
import { useMyProducts, useDeleteMyProduct } from '@/hooks/useSellerInventory';
import { api } from '@/lib/api';
import ProductFormModal from '@/components/ProductFormModal';
import ProductDetailModal from '@/components/ProductDetailModal';
import BulkUploadModal from '@/components/BulkUploadModal';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

const CONDITION_LABEL: Record<string, string> = { brand_new: 'Brand New', like_new: 'Like New', used: 'Used' };

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const del = useDeleteMyProduct();

  const { data, isLoading } = useMyProducts({ page, search });
  const products = data?.data ?? [];
  const meta = data?.meta;

  async function downloadInventory() {
    setDownloading(true);
    try {
      const res = await api.get('/products/seller/mine/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download inventory. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Inventory</h1>
        <div className="flex gap-2">
          <button onClick={downloadInventory} disabled={downloading} className="btn-secondary btn-sm px-4 py-2 disabled:opacity-50">
            {downloading ? 'Preparing…' : '↓ Download Inventory'}
          </button>
          <button onClick={() => setShowBulk(true)} className="btn-secondary btn-sm px-4 py-2">↑ Bulk Upload</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm px-4 py-2">+ Add Listing</button>
        </div>
      </div>

      <div className="card p-4">
        <input
          type="search"
          placeholder="Search my listings…"
          className="input w-72"
          onChange={(e) => { setSearch(e.target.value || undefined); setPage(1); }}
        />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : products.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">No listings yet. Add your first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Listing</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Condition</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Discount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Qty</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p: any) => {
                  const disc = Number(p.discountPercent ?? 0);
                  const mrp = p.mrp != null ? Number(p.mrp) : null;
                  const hasDisc = disc > 0 && mrp != null && mrp > Number(p.price);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setViewId(p.id)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      title="View full details"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />}
                          <div>
                            <p className="font-medium text-gray-900">{p.nameEn}</p>
                            <p className="text-xs text-gray-400">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.category?.nameEn ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant="blue">{CONDITION_LABEL[p.condition] ?? p.condition}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">Rs. {Number(p.price).toLocaleString('en-IN')}</span>
                        {hasDisc && <span className="block text-xs text-gray-400 line-through">Rs. {mrp!.toLocaleString('en-IN')}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasDisc ? <Badge variant="red">{disc}% OFF</Badge> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{p.stockQuantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); setEditId(p.id); }} className="text-gray-400 hover:text-primary-600 min-h-0 min-w-0 p-1" title="Edit">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }} className="text-gray-400 hover:text-red-500 min-h-0 min-w-0 p-1" title="Remove">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
            <span className="text-xs text-gray-500">{meta.total} listings</span>
            <div className="flex gap-2">
              <button disabled={!meta.hasPrevPage} onClick={() => setPage((p) => p - 1)} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">← Prev</button>
              <span className="text-xs text-gray-500 flex items-center px-2">{page} / {meta.totalPages}</span>
              <button disabled={!meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="btn-secondary btn-sm px-3 py-1.5 disabled:opacity-50">Next →</button>
            </div>
          </div>
        )}
      </div>

      <ProductDetailModal
        open={!!viewId}
        productId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(pid) => { setViewId(null); setEditId(pid); }}
      />

      <ProductFormModal open={showCreate || !!editId} onClose={() => { setShowCreate(false); setEditId(null); }} editId={editId} />

      <BulkUploadModal open={showBulk} onClose={() => setShowBulk(false)} />

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Listing">
        <p className="text-sm text-gray-600 mb-6">Remove this listing from the marketplace? It will no longer be visible to buyers.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeleteId(null)} className="btn-secondary btn-sm px-4 py-2">Cancel</button>
          <button onClick={() => del.mutate(deleteId!, { onSuccess: () => setDeleteId(null) })} disabled={del.isPending} className="btn-danger btn-sm px-4 py-2">
            {del.isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
