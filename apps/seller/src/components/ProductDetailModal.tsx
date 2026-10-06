import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { useMyProduct } from '@/hooks/useSellerInventory';

interface Props {
  open: boolean;
  productId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const CONDITION_LABEL: Record<string, string> = { brand_new: 'Brand New', like_new: 'Like New', used: 'Used' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', inactive: 'Inactive / Draft', out_of_stock: 'Out of Stock' };

function rs(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  return `Rs. ${Number(n).toLocaleString('en-IN')}`;
}

// Read-only full view of a seller's product, with an Edit action.
export default function ProductDetailModal({ open, productId, onClose, onEdit }: Props) {
  const { data: p, isLoading } = useMyProduct(productId ?? '');

  const mrp = p?.mrp != null ? Number(p.mrp) : null;
  const price = p ? Number(p.price) : 0;
  const discount = Number(p?.discountPercent ?? 0);
  const hasDiscount = discount > 0 && mrp != null && mrp > price;
  const variants: any[] = Array.isArray(p?.variants) ? p!.variants : [];

  return (
    <Modal open={open} onClose={onClose} title="Product Details">
      {isLoading || !p ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          {/* Header: image + name + status */}
          <div className="flex gap-4">
            {p.images?.[0] ? (
              <img src={p.images[0].url} alt="" className="h-20 w-20 rounded-lg object-cover border border-gray-200 shrink-0" />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">{p.nameEn}</h3>
              <p className="text-xs text-gray-400 mb-1">{p.sku}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={p.status === 'active' ? 'green' : p.status === 'out_of_stock' ? 'red' : 'yellow'}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
                <Badge variant="blue">{CONDITION_LABEL[p.condition] ?? p.condition}</Badge>
              </div>
            </div>
          </div>

          {/* Pricing incl. discount */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Pricing</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold text-primary-700">{rs(price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-sm text-gray-400 line-through">{rs(mrp)}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">{discount}% OFF</span>
                </>
              )}
              <span className="text-sm text-gray-500">/ {p.unit}</span>
            </div>
            {hasDiscount ? (
              <p className="text-xs text-green-600 mt-1">Customer saves {rs(mrp! - price)} ({discount}% off).</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">No discount set. Add an original price (MRP) + discount % to show a markdown.</p>
            )}
          </div>

          {/* Facts grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><span className="text-gray-500">Category:</span> <span className="text-gray-900">{p.category?.nameEn ?? '—'}</span></div>
            <div><span className="text-gray-500">Brand:</span> <span className="text-gray-900">{p.brand || '—'}</span></div>
            <div><span className="text-gray-500">Total stock:</span> <span className="text-gray-900">{p.stockQuantity}</span></div>
            <div><span className="text-gray-500">Unit:</span> <span className="text-gray-900">{p.unit}</span></div>
          </div>

          {/* Description */}
          {p.descriptionEn && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.descriptionEn}</p>
            </div>
          )}

          {/* Variants with per-variant price */}
          {variants.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Options / Variants ({variants.length})</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Option</th>
                      <th className="text-right px-3 py-1.5 font-medium">Price</th>
                      <th className="text-right px-3 py-1.5 font-medium">MRP</th>
                      <th className="text-right px-3 py-1.5 font-medium">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.map((v, i) => {
                      const label = [v.size, v.color].filter(Boolean).join(' / ') || v.label || `Option ${i + 1}`;
                      return (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-800">{label}</td>
                          <td className="px-3 py-1.5 text-right">{v.price != null ? rs(v.price) : rs(price)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-400">{v.mrp != null ? rs(v.mrp) : '—'}</td>
                          <td className="px-3 py-1.5 text-right">{Number(v.stock) || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Specifications */}
          {Array.isArray(p.specifications) && p.specifications.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Specifications</p>
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <tbody>
                  {p.specifications.map((s: any, i: number) => (
                    <tr key={i} className={i % 2 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 text-gray-600 w-1/2">{s.key}</td>
                      <td className="px-3 py-1.5 text-gray-900">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary btn-sm px-4 py-2">Close</button>
            <button onClick={() => p && onEdit(p.id)} className="btn-primary btn-sm px-4 py-2">Edit this listing</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
