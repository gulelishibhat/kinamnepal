import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAdminProduct } from '@/hooks/useInventory';
import ProductFormModal from '@/components/inventory/ProductFormModal';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';

const CONDITION_LABELS: Record<string, string> = {
  brand_new: 'Brand New',
  like_new: 'Like New',
  used: 'Used',
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading } = useAdminProduct(id!);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!product) return (
    <div className="text-center py-24 text-gray-400">
      Product not found. <Link to="/inventory" className="text-primary-700 underline">Back</Link>
    </div>
  );

  const images: any[] = product.images ?? [];
  const isLow = product.stockQuantity <= product.lowStockThreshold;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/inventory" className="text-sm text-gray-500 hover:text-gray-700">← Inventory</Link>
        <h1 className="text-xl font-bold text-gray-900">{product.nameEn}</h1>
        <Badge variant={product.status === 'active' ? 'green' : product.status === 'out_of_stock' ? 'red' : 'gray'}>
          {product.status}
        </Badge>
        <button onClick={() => setEditOpen(true)} className="btn-primary btn-sm px-3 py-1.5 text-xs ml-auto">Edit</button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Images */}
        <div className="card p-4">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {images[0] ? (
              <img src={images[0].url} alt={product.nameEn} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {images.map((img: any, i: number) => (
                <img key={img.id ?? i} src={img.url} alt="" className="h-14 w-14 rounded object-cover shrink-0 border border-gray-200" />
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="card p-5 space-y-3 md:col-span-2">
          <h2 className="font-semibold text-gray-900">Product details</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-gray-500">Name (EN): </span><span className="text-gray-800">{product.nameEn}</span></div>
            <div><span className="text-gray-500">Name (NE): </span><span className="text-gray-800">{product.nameNe || '—'}</span></div>
            <div><span className="text-gray-500">Brand: </span><span className="text-gray-800">{product.brand || '—'}</span></div>
            <div><span className="text-gray-500">SKU: </span><span className="font-mono text-xs text-gray-800">{product.sku}</span></div>
            <div><span className="text-gray-500">Category: </span><span className="text-gray-800">{product.category?.nameEn ?? '—'}</span></div>
            <div><span className="text-gray-500">Condition: </span><span className="text-gray-800">{CONDITION_LABELS[product.condition] ?? product.condition ?? '—'}</span></div>
            <div><span className="text-gray-500">Price: </span><span className="text-gray-800 font-semibold">NPR {Number(product.price).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Unit: </span><span className="text-gray-800">{product.unit}</span></div>
            <div>
              <span className="text-gray-500">Stock: </span>
              <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{product.stockQuantity}</span>
              {isLow && <span className="ml-1 text-xs text-red-500">⚠ Low</span>}
            </div>
            <div><span className="text-gray-500">Created: </span><span className="text-gray-800">{new Date(product.createdAt).toLocaleDateString()}</span></div>
          </div>

          {product.descriptionEn && (
            <div className="pt-2">
              <p className="text-gray-500 text-sm mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.descriptionEn}</p>
            </div>
          )}
        </div>
      </div>

      {/* Seller info */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Seller</h2>
        {product.seller ? (
          <Link
            to={`/sellers/${product.seller.id}`}
            className="flex items-center gap-3 group w-fit"
          >
            <div className="h-11 w-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              {product.seller.shopName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">{product.seller.shopName}</p>
              <p className="font-mono text-xs text-gray-500">{product.seller.id}</p>
              <p className="text-xs text-primary-700 group-hover:underline">View seller profile →</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-gray-400">No seller assigned (store-owned listing).</p>
        )}
      </div>

      {/* Specifications */}
      {product.specifications?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Specifications</h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {product.specifications.map((spec: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-3 font-medium text-gray-700 w-1/2 border border-gray-200">{spec.key}</td>
                  <td className="py-2 px-3 text-gray-600 border border-gray-200">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} editId={id ?? null} />
    </div>
  );
}
