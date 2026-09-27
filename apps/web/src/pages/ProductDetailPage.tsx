import { useState, useMemo, useEffect } from 'react';
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
  const [selectedBase, setSelectedBase] = useState<string>('');   // variant "size" axis (spec / holder)
  const [selectedColour, setSelectedColour] = useState<string>(''); // variant "color" axis (finish / colour)
  const addItem = useCartStore((s) => s.addItem);

  // Reset quantity to 1 whenever the chosen specification/variant changes, so
  // the live total is always valid against the newly-selected option's stock.
  useEffect(() => { setQuantity(1); }, [selectedBase, selectedColour]);

  // Distinct option values for each axis, derived from the product's variants.
  const variants: any[] = product?.variants ?? [];
  const baseOptions = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))),
    [variants],
  );
  const colourOptions = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))),
    [variants],
  );
  const hasBase = baseOptions.length > 0;
  const hasColour = colourOptions.length > 0;
  const hasVariants = hasBase || hasColour;

  // Axis heading: switches use the "size" axis for the full spec, bulbs use it
  // for the holder base. Infer a friendly label from the category.
  const catName: string = (product as any)?.category?.nameEn ?? '';
  const baseAxisLabel = catName === 'Bulbs' ? 'Holder / Base size'
    : catName === 'Switches' ? 'Specification'
    : 'Option';
  const colourAxisLabel = 'Colour';

  // The variant row matching the current selection (if the axis is required).
  const matchedVariant = useMemo(() => {
    if (!hasVariants) return null;
    return variants.find(
      (v) => (!hasBase || v.size === selectedBase) && (!hasColour || v.color === selectedColour),
    ) ?? null;
  }, [variants, hasBase, hasColour, selectedBase, selectedColour, hasVariants]);

  // Cheapest priced variant → used as the "from" price before a selection.
  // Declared here (before any early return) to satisfy the Rules of Hooks.
  const cheapestVariant = useMemo(() => {
    const priced = variants.filter((v) => v.price != null && Number(v.price) > 0);
    if (priced.length === 0) return null;
    return priced.reduce((min, v) => (Number(v.price) < Number(min.price) ? v : min), priced[0]);
  }, [variants]);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (isError || !product) return (
    <div className="text-center py-24 text-gray-400">
      <p>Product not found.</p>
      <Link to="/products" className="text-primary-700 underline mt-2 inline-block">Back to products</Link>
    </div>
  );

  const name = locale === 'ne' ? product.nameNe : product.nameEn;
  const description = locale === 'ne' ? product.descriptionNe : product.descriptionEn;
  const basePrice = Number(product.price);
  const baseDiscountPercent = Number((product as any).discountPercent ?? 0);
  const baseMrp = (product as any).mrp != null ? Number((product as any).mrp) : null;
  const images: any[] = product.images ?? [];

  // Whether any variant carries its own price (B2 per-variant pricing).
  const variantsHavePrice = variants.some((v) => v.price != null && Number(v.price) > 0);

  // Selection state.
  const selectionComplete = !hasVariants || (!!matchedVariant && (!hasBase || !!selectedBase) && (!hasColour || !!selectedColour));

  // Effective price / mrp: from the selected variant when it has its own
  // price; otherwise the product's base price. Before a full selection is made
  // on a priced-variant product, show the cheapest variant as a "from" price.
  const priceSource = (selectionComplete && matchedVariant?.price != null) ? matchedVariant
    : (!selectionComplete && variantsHavePrice ? cheapestVariant : null);
  const showFromPrice = variantsHavePrice && !selectionComplete;

  const price = priceSource?.price != null ? Number(priceSource.price) : basePrice;
  const mrp = priceSource?.mrp != null ? Number(priceSource.mrp)
    : (priceSource ? null : baseMrp);
  const discountPercent = mrp != null && mrp > price ? Math.round(((mrp - price) / mrp) * 100)
    : (priceSource ? 0 : baseDiscountPercent);
  const hasDiscount = discountPercent > 0 && mrp != null && mrp > price;

  // Effective stock: the matched variant's stock when variants exist and a
  // full selection is made; otherwise the product-level stock.
  const effectiveStock = hasVariants
    ? (matchedVariant ? Number(matchedVariant.stock) || 0 : 0)
    : product.stockQuantity;
  const isOutOfStock = product.status === 'out_of_stock' || (selectionComplete && effectiveStock === 0);
  const isLowStock = !isOutOfStock && selectionComplete && effectiveStock <= 5;

  // Human label for the chosen option(s), e.g. "B22 / Warm White" or a spec.
  const variantLabel = [hasBase ? selectedBase : '', hasColour ? selectedColour : ''].filter(Boolean).join(' / ');

  function handleAddToCart() {
    if (hasVariants && !selectionComplete) {
      toast.error('Please select an option first');
      return;
    }
    const suffix = variantLabel ? ` (${variantLabel})` : '';
    // Charge the selected variant's price when it has one, else the base price.
    const unitPrice = matchedVariant?.price != null ? Number(matchedVariant.price) : basePrice;
    addItem({
      productId: product.id, // real UUID preserved for checkout
      variant: variantLabel || undefined,
      name: { en: product.nameEn + suffix, ne: product.nameNe + suffix },
      price: unitPrice,
      unit: product.unit,
      image: images[0]?.url,
      stock: effectiveStock,
    }, quantity);
    toast.success(`${name}${suffix} added to cart`);
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

          <div className="flex items-baseline gap-2 flex-wrap">
            {showFromPrice && <span className="text-gray-500 text-lg">From</span>}
            <span className="text-3xl font-bold text-primary-700">{formatPrice(price)}</span>
            <span className="text-gray-500">/{product.unit}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatPrice(mrp!)}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-sm font-bold bg-red-600 text-white">{discountPercent}% OFF</span>
              </>
            )}
          </div>
          {hasDiscount && selectionComplete && (
            <p className="text-sm text-green-600 font-medium">You save {formatPrice(mrp! - price)} ({discountPercent}% off)</p>
          )}
          {variantsHavePrice && !selectionComplete && (
            <p className="text-sm text-gray-500">Select an option below to see its price.</p>
          )}

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
                  onClick={() => setQuantity((q) => Math.min(effectiveStock || 1, q + 1))}
                  disabled={selectionComplete && quantity >= effectiveStock}
                  className="h-9 w-9 min-h-0 min-w-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Live line total — updates with the selected spec's price × quantity */}
          {selectionComplete && !isOutOfStock && (
            <div className="flex items-baseline justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-600">
                Total {quantity > 1 && <span className="text-gray-400">({formatPrice(price)} × {quantity})</span>}
              </span>
              <span className="text-2xl font-bold text-primary-700">{formatPrice(price * quantity)}</span>
            </div>
          )}

          {/* CTAs — sticky on mobile */}
          <div className="fixed bottom-14 left-0 right-0 p-4 bg-white border-t border-gray-200 md:relative md:bottom-auto md:p-0 md:border-0 flex gap-3 z-30">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || (hasVariants && !selectionComplete)}
              className="btn-primary flex-1 py-3 text-base disabled:opacity-50"
            >
              {t('product.addToCart')}
            </button>
            <Link
              to="/cart"
              onClick={(e) => {
                if (hasVariants && !selectionComplete) { e.preventDefault(); toast.error('Please select an option first'); return; }
                if (isOutOfStock) { e.preventDefault(); return; }
                handleAddToCart();
              }}
              className={`btn-secondary flex-1 py-3 text-base text-center ${(isOutOfStock || (hasVariants && !selectionComplete)) ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {t('product.buyNow')}
            </Link>
          </div>

          {/* Description */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">{t('product.description')}</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          {/* Variant selectors — pick Holder size and Colour */}
          {hasVariants && (
            <div className="space-y-4">
              {hasBase && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {baseAxisLabel} {selectedBase && <span className="text-gray-400 font-normal">— {selectedBase}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {baseOptions.map((base: string) => {
                      // Representative variant for this base (respecting the colour filter).
                      const rep = variants.find(
                        (v) => v.size === base && (!hasColour || !selectedColour || v.color === selectedColour),
                      );
                      const available = variants.some(
                        (v) => v.size === base && (!hasColour || !selectedColour || v.color === selectedColour) && (Number(v.stock) || 0) > 0,
                      );
                      const active = selectedBase === base;
                      const optPrice = rep?.price != null ? Number(rep.price) : null;
                      return (
                        <button
                          key={base}
                          onClick={() => setSelectedBase(active ? '' : base)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                            active ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : available ? 'border-gray-300 text-gray-800 hover:border-primary-400'
                            : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          <span className="block">{base}</span>
                          {optPrice != null && (
                            <span className={`block text-xs ${active ? 'text-primary-600' : 'text-gray-500'}`}>{formatPrice(optPrice)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasColour && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {colourAxisLabel} {selectedColour && <span className="text-gray-400 font-normal">— {selectedColour}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {colourOptions.map((colour: string) => {
                      const available = variants.some(
                        (v) => v.color === colour && (!hasBase || !selectedBase || v.size === selectedBase) && (Number(v.stock) || 0) > 0,
                      );
                      const active = selectedColour === colour;
                      return (
                        <button
                          key={colour}
                          onClick={() => setSelectedColour(active ? '' : colour)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            active ? 'border-primary-600 bg-primary-50 text-primary-700'
                            : available ? 'border-gray-300 text-gray-800 hover:border-primary-400'
                            : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {colour}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selection feedback */}
              {!selectionComplete ? (
                <p className="text-sm text-amber-600">Select an option to continue.</p>
              ) : effectiveStock > 0 ? (
                <p className="text-sm text-green-600">{variantLabel} — in stock ({effectiveStock} available)</p>
              ) : (
                <p className="text-sm text-red-500">{variantLabel} — out of stock</p>
              )}
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
