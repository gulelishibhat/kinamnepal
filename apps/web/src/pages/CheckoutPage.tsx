import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { usePlaceOrder } from '@/hooks/useOrders';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { api } from '@/lib/api';
import QRPaymentScreen from '@/components/order/QRPaymentScreen';
import Spinner from '@/components/ui/Spinner';
import type { Locale, PaymentType } from '@mkelectric/shared';

type Step = 'delivery' | 'review' | 'payment';

interface FormData {
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  street: string;
  city: string;
  district: string;
  notes: string;
}

// Small brand icon per method (emoji keeps it dependency-free).
const METHOD_ICON: Record<string, string> = {
  nepalpay: '📷',
  esewa: '🟢',
  khalti: '🟣',
  fonepay: '🏦',
  bank: '🏛️',
};

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as Locale;
  const { items, subtotal } = useCartStore();
  const user = useAuthStore((s) => s.user);
  const placeOrder = usePlaceOrder();
  const navigate = useNavigate();
  const { data: paymentConfig } = usePaymentConfig();

  const [step, setStep] = useState<Step>('delivery');
  const [paymentType, setPaymentType] = useState<PaymentType>('online');
  const [selectedMethod, setSelectedMethod] = useState<string>(''); // esewa | khalti | nepalpay | bank
  const [redirecting, setRedirecting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ orderId: string; orderNumber: string; total: number; method?: string } | null>(null);
  const [form, setForm] = useState<FormData>({
    guestName: '', guestPhone: '', guestEmail: '',
    street: '', city: '', district: '', notes: '',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const isEmpty = items.length === 0;
  if (isEmpty) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-500 mb-4">Your cart is empty.</p>
        <Link to="/cart" className="btn-primary px-6 py-3">Go to Cart</Link>
      </div>
    );
  }

  const methods = paymentConfig?.methods ?? [];
  // Default the selected method to the first online method once config loads.
  const effectiveMethod = selectedMethod || methods[0]?.id || '';
  const chosen = methods.find((m) => m.id === effectiveMethod);

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!user) {
      if (!form.guestName.trim()) e.guestName = 'Name is required';
      if (!form.guestPhone.match(/^(98|97)\d{8}$/)) e.guestPhone = 'Enter a valid Nepali mobile number';
    }
    if (!form.street.trim()) e.street = 'Street address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.district.trim()) e.district = 'District is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleConfirmAndPay() {
    const payload = {
      ...(user ? {} : { guestName: form.guestName, guestPhone: form.guestPhone, guestEmail: form.guestEmail || undefined }),
      deliveryAddress: { street: form.street, city: form.city, district: form.district },
      paymentType,
      notes: form.notes || undefined,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };

    let result;
    try {
      result = await placeOrder.mutateAsync(payload as any);
    } catch {
      return; // usePlaceOrder shows an error toast
    }

    // Cash on delivery — already confirmed, go to the success page.
    if (result.paymentType === 'cod') {
      navigate(`/order-success/${result.orderId}?orderNumber=${encodeURIComponent(result.orderNumber)}`);
      return;
    }

    // Online + a redirect method (eSewa / Khalti) → go straight to the provider.
    if (chosen?.mode === 'redirect' && chosen.initiatePath) {
      setRedirecting(true);
      try {
        const { data } = await api.post(chosen.initiatePath, {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          amount: result.total,
        });
        const url = data?.data?.redirectUrl;
        if (url) { window.location.href = url; return; }
        toast.error('Could not start payment. Showing other options.');
      } catch {
        toast.error('Could not start payment. Showing other options.');
      }
      setRedirecting(false);
    }

    // Online + QR/manual (or redirect fell back) → show the payment screen,
    // opening on the method the customer picked.
    setPlacedOrder({ ...result, method: effectiveMethod });
    setStep('payment');
  }

  if (step === 'payment' && placedOrder) {
    return (
      <QRPaymentScreen
        orderId={placedOrder.orderId}
        orderNumber={placedOrder.orderNumber}
        total={placedOrder.total}
        initialMethodId={placedOrder.method}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('checkout.title')}</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        {(['delivery', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-primary-700 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</span>
            <span className={step === s ? 'text-primary-700 font-medium' : 'text-gray-400'}>
              {t(`checkout.steps.${s}`)}
            </span>
            {i < 1 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      <div className="card p-6 space-y-6">
        {step === 'delivery' && (
          <>
            {!user && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-900">{t('checkout.guest.title')}</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.guest.name')} *</label>
                  <input className="input" value={form.guestName} onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))} />
                  {errors.guestName && <p className="text-red-500 text-xs mt-1">{errors.guestName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.guest.phone')} *</label>
                  <input className="input" value={form.guestPhone} onChange={(e) => setForm((f) => ({ ...f, guestPhone: e.target.value }))} placeholder="98XXXXXXXX" />
                  {errors.guestPhone && <p className="text-red-500 text-xs mt-1">{errors.guestPhone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.guest.email')}</label>
                  <input className="input" type="email" value={form.guestEmail} onChange={(e) => setForm((f) => ({ ...f, guestEmail: e.target.value }))} />
                </div>
                <p className="text-sm text-gray-500">
                  {t('checkout.guest.orLogin')}{' '}
                  <Link to="/login" className="text-primary-700 underline">{t('checkout.guest.loginLink')}</Link>
                </p>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900">{t('checkout.delivery.title')}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.delivery.street')} *</label>
                <input className="input" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
                {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.delivery.city')} *</label>
                  <input className="input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.delivery.district')} *</label>
                  <input className="input" value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
                  {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <button onClick={() => { if (validate()) setStep('review'); }} className="btn-primary w-full py-3">
              {t('common.next')} →
            </button>
          </>
        )}

        {step === 'review' && (
          <>
            <h2 className="font-semibold text-gray-900">{t('checkout.review.title')}</h2>

            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => {
                const name = locale === 'ne' ? item.name.ne : item.name.en;
                return (
                  <div key={item.productId} className="flex items-center gap-3">
                    {item.image && <img src={item.image} alt={name} className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500">×{item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold">NPR {(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between font-bold text-gray-900">
                <span>{t('cart.total')}</span>
                <span>NPR {subtotal().toLocaleString()}</span>
              </div>
            </div>

            {/* Delivery */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800 mb-1">{t('checkout.review.deliveryTo')}</p>
              <p>{form.street}, {form.city}, {form.district}</p>
              {!user && <p className="mt-1">{form.guestName} · {form.guestPhone}</p>}
            </div>

            {/* Payment type */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">How would you like to pay?</h3>

              <button
                type="button"
                onClick={() => setPaymentType('online')}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors min-h-0 ${
                  paymentType === 'online' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${paymentType === 'online' ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">Pay Online</span>
                      <span className="text-[11px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">QR, eSewa, Khalti, Fonepay or bank transfer. Fast and contactless.</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('cod')}
                className={`w-full text-left rounded-xl border-2 p-4 transition-colors min-h-0 ${
                  paymentType === 'cod' ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 ${paymentType === 'cod' ? 'border-primary-600 bg-primary-600' : 'border-gray-300'}`} />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900">Cash on Delivery</span>
                    <p className="text-xs text-gray-500 mt-0.5">Pay cash when your order arrives. Available within Pokhara.</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Specific online method chooser — shown only when paying online */}
            {paymentType === 'online' && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Choose payment app</h3>
                {methods.length === 0 ? (
                  <div className="flex justify-center py-4"><Spinner /></div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-colors min-h-0 ${
                          effectiveMethod === m.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{METHOD_ICON[m.id] ?? '💳'}</span>
                        <span className="text-sm font-medium text-gray-800">{m.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {chosen?.mode === 'redirect' && (
                  <p className="text-xs text-gray-500">You'll be redirected to {chosen.label} to complete payment securely.</p>
                )}
                {chosen?.mode === 'qr' && (
                  <p className="text-xs text-gray-500">You'll see a QR to scan with any wallet or banking app.</p>
                )}
                {chosen?.mode === 'manual' && (
                  <p className="text-xs text-gray-500">You'll see our bank account details to transfer to.</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('delivery')} className="btn-secondary flex-1 py-3">
                ← {t('common.back')}
              </button>
              <button
                onClick={handleConfirmAndPay}
                disabled={placeOrder.isPending || redirecting}
                className="btn-primary flex-1 py-3"
              >
                {placeOrder.isPending || redirecting
                  ? 'Processing…'
                  : paymentType === 'cod'
                    ? 'Place Order (Cash on Delivery)'
                    : chosen?.mode === 'redirect'
                      ? `Pay with ${chosen.label}`
                      : 'Confirm & Pay'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
