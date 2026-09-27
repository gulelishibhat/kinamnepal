import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cart.store';
import toast from 'react-hot-toast';
import { formatPrice, timeAgo, conditionLabel, conditionBadgeClasses } from '@/lib/format';
import type { Locale } from '@mkelectric/shared';

interface ProductCardProps {
  product: {
    id: string;
    nameEn: string;
    nameNe: string;
    price: string | number;
    mrp?: string | number | null;
    discountPercent?: number;
    unit: string;
    stockQuantity: number;
    status: string;
    images: Array<{ url: string }>;
    brand: string;
    condition?: string;
    createdAt?: string;
    seller?: { id: string; shopName: string } | null;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const addItem = useCartStore((s) => s.addItem);

  const name = locale === 'ne' ? product.nameNe : product.nameEn;
  const price = Number(product.price);
  const discountPercent = Number(product.discountPercent ?? 0);
  const mrp = product.mrp != null ? Number(product.mrp) : null;
  const hasDiscount = discountPercent > 0 && mrp != null && mrp > price;
  const image = product.images[0]?.url;
  const isOutOfStock = product.status === 'out_of_stock' || product.stockQuantity === 0;
  const condLabel = conditionLabel(product.condition);
  const posted = timeAgo(product.createdAt);
  const sellerName = product.seller?.shopName;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    addItem({
      productId: product.id,
      name: { en: product.nameEn, ne: product.nameNe },
      price,
      unit: product.unit,
      image,
      stock: product.stockQuantity,
    });
    toast.success(`${name} added to cart`);
  }

  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all"
    >
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {condLabel && (
          <span className={`absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${conditionBadgeClasses(product.condition)}`}>
            {condLabel}
          </span>
        )}
        {hasDiscount && (
          <span className="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white shadow">
            {discountPercent}% OFF
          </span>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-gray-700">
              {t('product.outOfStock')}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-1">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug min-h-[2.5rem]">{name}</h3>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-lg font-bold text-primary-700">{formatPrice(price)}</p>
          {hasDiscount && (
            <>
              <span className="text-xs text-gray-400 line-through">{formatPrice(mrp!)}</span>
              <span className="text-xs font-semibold text-red-600">{discountPercent}% off</span>
            </>
          )}
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
          <span className="text-xs text-gray-500 truncate">{sellerName ?? product.brand}</span>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="h-8 w-8 min-h-0 min-w-0 shrink-0 flex items-center justify-center bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={t('product.addToCart')}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.4 5.6M7 13l-1.4 5.6m0 0h11.8M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
            </svg>
          </button>
        </div>
        {posted && <p className="text-[11px] text-gray-400">{posted}</p>}
      </div>
    </Link>
  );
}
