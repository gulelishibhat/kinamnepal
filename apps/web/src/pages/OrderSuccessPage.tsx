import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrder } from '@/hooks/useOrders';
import { useAuthStore } from '@/store/auth.store';
import OrderStatusBadge from '@/components/order/OrderStatusBadge';
import Spinner from '@/components/ui/Spinner';
import type { Locale, OrderStatus } from '@mkelectric/shared';

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');
  const paid = searchParams.get('paid'); // success | failed | pending (from gateway callback)
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const user = useAuthStore((s) => s.user);
  const { data: order, isLoading } = useOrder(id!);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Payment result banner (from gateway redirect) */}
      {paid === 'success' && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-800 text-sm text-center font-medium">
          Payment received — your order is confirmed. Thank you!
        </div>
      )}
      {paid === 'failed' && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm text-center font-medium">
          Payment was not completed. Your order is saved — you can try paying again or choose Cash on Delivery.
        </div>
      )}
      {paid === 'pending' && (
        <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm text-center font-medium">
          We're confirming your payment. This can take a moment.
        </div>
      )}

      {/* Success header */}
      <div className="text-center mb-8">
        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{t('order.success.title')}</h1>
        <p className="text-gray-500 mt-2">{t('order.success.subtitle')}</p>
        {orderNumber && (
          <div className="mt-4 inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2">
            <span className="text-sm text-gray-600">{t('order.success.orderNumber')}:</span>
            <span className="font-bold text-primary-700">{orderNumber}</span>
          </div>
        )}
      </div>

      {/* Order detail */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : order ? (
        <div className="card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{t('order.detail.items')}</h2>
            <OrderStatusBadge status={order.status as OrderStatus} />
          </div>

          <div className="space-y-3">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3">
                {item.productImage && (
                  <img src={item.productImage} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {locale === 'ne' ? item.productNameNe : item.productNameEn}
                  </p>
                  <p className="text-xs text-gray-500">×{item.quantity} · NPR {Number(item.unitPrice).toLocaleString()}</p>
                </div>
                <span className="text-sm font-semibold">NPR {Number(item.lineTotal).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-4 flex justify-between font-bold text-gray-900">
            <span>{t('cart.total')}</span>
            <span>NPR {Number(order.total).toLocaleString()}</span>
          </div>

          {/* Delivery */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p className="font-medium text-gray-800 mb-1">{t('order.detail.delivery')}</p>
            <p>{order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.district}</p>
          </div>

          {order.status === 'pending_payment' && (
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
              {t('order.success.paymentPending')}
            </p>
          )}

          {order.payment?.paymentMethod === 'cash' && (
            <div className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="font-semibold text-green-800">Cash on Delivery</p>
              <p className="mt-0.5">
                Please keep <span className="font-bold">NPR {Number(order.total).toLocaleString()}</span> ready to pay our delivery rider on arrival.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        {user && id && (
          <Link to={`/orders/${id}`} className="btn-primary flex-1 py-3 text-center">
            {t('order.success.viewOrder')}
          </Link>
        )}
        <Link to="/products" className="btn-secondary flex-1 py-3 text-center">
          {t('order.success.continueShopping')}
        </Link>
      </div>

      {/* Guest register prompt */}
      {!user && (
        <div className="mt-6 text-center bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-sm text-gray-700">{t('order.success.registerPrompt')}</p>
          <Link to="/register" className="text-primary-700 font-semibold text-sm hover:underline mt-1 inline-block">
            {t('order.success.registerCta')}
          </Link>
        </div>
      )}
    </div>
  );
}
