import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cart.store';
import type { Locale } from '@mkelectric/shared';

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const { items, updateQuantity, removeItem, subtotal, totalItems } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-gray-200 mb-6">
          <svg className="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.4 5.6M7 13l-1.4 5.6m0 0h11.8M17 18a1 1 0 100 2 1 1 0 000-2zm-8 0a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.empty')}</h1>
        <p className="text-gray-500 mb-8">{t('cart.emptySubtext')}</p>
        <Link to="/products" className="btn-primary px-8 py-3">{t('cart.shopNow')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t('cart.title')} — {t('cart.items', { count: totalItems() })}
      </h1>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Items */}
        <div className="md:col-span-2 space-y-4">
          {items.map((item) => {
            const name = locale === 'ne' ? item.name.ne : item.name.en;
            return (
              <div key={item.productId} className="card p-4 flex gap-4">
                {/* Thumbnail */}
                <div className="h-20 w-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-300">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{name}</h3>
                  <p className="text-sm text-gray-500">NPR {item.price.toLocaleString()}/{item.unit}</p>

                  <div className="flex items-center justify-between mt-3">
                    {/* Quantity stepper */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="h-8 w-8 min-h-0 min-w-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
                      >−</button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                        className="h-8 w-8 min-h-0 min-w-0 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 text-sm disabled:opacity-50"
                      >+</button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">
                        NPR {(item.price * item.quantity).toLocaleString()}
                      </span>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        aria-label={t('cart.remove')}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="card p-6 h-fit sticky top-20">
          <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('cart.subtotal')}</span>
              <span>NPR {subtotal().toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900 text-base">
              <span>{t('cart.total')}</span>
              <span>NPR {subtotal().toLocaleString()}</span>
            </div>
          </div>
          <Link to="/checkout" className="btn-primary w-full mt-6 py-3 text-center">
            {t('cart.checkout')}
          </Link>
          <Link to="/products" className="btn-secondary w-full mt-3 py-3 text-center text-sm">
            {t('cart.continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  );
}
