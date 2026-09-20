import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cart.store';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { formatPrice, timeAgo, conditionLabel, conditionBadgeClasses } from '@/lib/format';
import type { Locale } from '@mkelectric/shared';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const { data: product, isLoading, isError } = useProduct(id!);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (isError || !product) return (
    <div className="text-center py-24 text-gray-400">
      <p>Product not found.</p>
      <Link to="/products" className="text-primary-700 underline mt-2 inline-block">Back to products</Link>
    </div>
  );

  const name = locale === 'ne' ? product.nameNe : product.nameEn;
  const description = locale === 'ne' ? product.descriptionNe : product.descriptionEn;
  const price = Number(product.price);
  const isOutOfStock = product.status === 'out_of_stock' || product.stockQuantity === 0;
  const isLowStock = !isOutOfStock && product.stockQuantity <= 5;
  const images: any[] = product.images ?? [];

  function handleAddToCart() {
    addItem({
      productId: product.id,
      name: { en: product.nameEn, ne: product.nameNe },
      price,
      unit: product.unit,
      image: images[0]?.url,
      stock: product.stockQuantity,
    }, quantity);
    toast.success(`${name} added to cart`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-primary-700">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-primary-700">
          {product.category ? (locale === 'ne' ? product.category.nameNe : product.category.nameEn) : 'Products'}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-[200px]">{name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
            {images[selectedImage] ? (
              <img
                src={images[selectedImage].url}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                </svg>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img: any, i: number) => (
                <button
                  key={img.id ?? i}
                  onClick={() => setSelectedImage(i)}
                  className={`shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImage === i ? 'border-primary-700' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-sm text-gray-500 font-medium">{product.brand}</p>
              {conditionLabel(product.condition) && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${conditionBadgeClasses(product.condition)}`}>
                  {conditionLabel(product.condition)}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{name}</h1>
            <p className="text-sm text-gray-400 mt-1">
              SKU: {product.sku}
              {product.createdAt && <span className="ml-2">· Posted {timeAgo(product.createdAt)}</span>}
            </p>
          </div>

          {/* Seller */}
          {product.seller?.shopName && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
                {product.seller.shopName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-gray-500">Sold by</p>
                <p className="text-sm font-semibold text-gray-900">{product.seller.shopName}</p>
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-700">{formatPrice(price)}</span>
            <span className="text-gray-500">/{product.unit}</span>
          </div>

          {/* Stock */}
          <div>
            {isOutOfStock ? (
              <Badge variant="red">{t('product.outOfStock')}</Badge>
            ) : isLowStock ? (
              <Badge variant="yellow">{t('product.lowStock', { count: product.stockQuantity })}</Badge>
            ) : (
              <Badge variant="green">{t('product.inStock')}</Badge>
            )}
          </div>

          {/* Quantity selector */}
          {!isOutOfStock && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">{t('product.selectQuantity')}:</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-9 w-9 min-h-0 min-w-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  −
                </button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stockQuantity, q + 1))}
                  className="h-9 w-9 min-h-0 min-w-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* CTAs — sticky on mobile */}
          <div className="fixed bottom-14 left-0 right-0 p-4 bg-white border-t border-gray-200 md:relative md:bottom-auto md:p-0 md:border-0 flex gap-3 z-30">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="btn-primary flex-1 py-3 text-base"
            >
              {t('product.addToCart')}
            </button>
            <Link
              to="/cart"
              onClick={handleAddToCart}
              className="btn-secondary flex-1 py-3 text-base text-center"
            >
              {t('product.buyNow')}
            </Link>
          </div>

          {/* Description */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">{t('product.description')}</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          {/* Available variants (size / colour) */}
          {product.variants?.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Available options</h2>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any, i: number) => {
                  const label = [v.size, v.color].filter(Boolean).join(' / ') || 'Option';
                  const out = (Number(v.stock) || 0) <= 0;
                  return (
                    <div
                      key={i}
                      className={`px-3 py-1.5 rounded-lg border text-sm ${out ? 'border-gray-200 text-gray-400 line-through' : 'border-gray-300 text-gray-800'}`}
                      title={out ? 'Out of stock' : `${v.stock} in stock`}
                    >
                      {label}
                      <span className={`ml-2 text-xs ${out ? 'text-gray-400' : 'text-gray-500'}`}>
                        {out ? 'Out of stock' : `${v.stock} left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specifications */}
          {product.specifications?.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">{t('product.specifications')}</h2>
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
        </div>
      </div>
    </div>
  );
}
