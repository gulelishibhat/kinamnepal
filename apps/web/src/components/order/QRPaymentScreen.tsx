import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { usePaymentConfig } from '@/hooks/usePaymentConfig';
import { api } from '@/lib/api';
import Spinner from '@/components/ui/Spinner';

const QR_TIMEOUT_SECONDS = 15 * 60;

interface QRPaymentScreenProps {
  orderId: string;
  orderNumber: string;
  total: number;
  initialMethodId?: string | undefined;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function QRPaymentScreen({ orderId, orderNumber, total, initialMethodId }: QRPaymentScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: config, isLoading } = usePaymentConfig();
  const [remaining, setRemaining] = useState(QR_TIMEOUT_SECONDS);
  const [activeMethod, setActiveMethod] = useState(0);
  const [redirecting, setRedirecting] = useState(false);
  const [pickedInitial, setPickedInitial] = useState(false);
  const expired = remaining <= 0;

  useEffect(() => {
    if (expired) return;
    const interval = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(interval);
  }, [expired]);

  // Open on the method the customer selected at checkout (once config loads).
  useEffect(() => {
    if (pickedInitial || !config || !initialMethodId) return;
    const idx = config.methods.findIndex((m) => m.id === initialMethodId);
    if (idx >= 0) setActiveMethod(idx);
    setPickedInitial(true);
  }, [config, initialMethodId, pickedInitial]);

  const method = config?.methods[activeMethod];
  // Fill the amount placeholder in the QR value (if present).
  const qrValue = method?.qrValue ? method.qrValue.replace('{AMOUNT}', String(total)) : '';

  async function handleRedirect() {
    if (!method?.initiatePath) return;
    setRedirecting(true);
    try {
      const { data } = await api.post(method.initiatePath, { orderId, orderNumber, amount: total });
      const url = data?.data?.redirectUrl;
      if (url) {
        // Send the customer to the provider's hosted checkout.
        window.location.href = url;
      } else {
        toast.error('Could not start payment. Please try another method.');
        setRedirecting(false);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Could not start payment.');
      setRedirecting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">{t('checkout.payment.title', 'Payment')}</h1>
          <p className="text-sm text-gray-500 mt-1">Order: {orderNumber}</p>
          <p className="text-3xl font-bold text-primary-700 mt-3">NPR {total.toLocaleString()}</p>
          <div className={`text-sm font-medium mt-1 ${remaining < 60 ? 'text-red-500' : 'text-gray-500'}`}>
            Session valid for {formatTime(remaining)}
          </div>
        </div>

        {expired ? (
          <div className="space-y-4 text-center">
            <p className="text-red-500 font-medium">The payment session has expired.</p>
            <button onClick={() => navigate('/')} className="btn-primary w-full py-3">Back to Home</button>
          </div>
        ) : isLoading || !config ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <>
            {/* How would you like to pay? */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2 text-center">Choose how to pay</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {config.methods.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMethod(i)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-0 ${
                      i === activeMethod
                        ? 'bg-primary-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {method && (
              <div className="space-y-4">
                {/* QR mode — render a scannable QR */}
                {method.mode === 'qr' && qrValue && (
                  <>
                    <div className="flex justify-center">
                      <div className="p-4 bg-white border-2 border-primary-200 rounded-xl">
                        <QRCodeSVG value={qrValue} size={210} level="M" />
                      </div>
                    </div>
                    <p className="text-center text-xs text-gray-500">
                      Open your wallet or banking app → Scan to Pay → confirm NPR {total.toLocaleString()}.
                    </p>
                  </>
                )}

                {/* Redirect mode — send to provider checkout */}
                {method.mode === 'redirect' && (
                  <div className="text-center space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                      You'll be securely redirected to <span className="font-semibold text-gray-800">{method.label}</span> to complete your payment of <span className="font-semibold">NPR {total.toLocaleString()}</span>.
                    </div>
                    <button
                      onClick={handleRedirect}
                      disabled={redirecting}
                      className="btn-primary w-full py-3"
                    >
                      {redirecting ? 'Redirecting…' : `Pay with ${method.label}`}
                    </button>
                  </div>
                )}

                {/* Account details (shown for qr + manual) */}
                {method.mode !== 'redirect' && method.details.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Pay to {config.storeName} — {method.label}</p>
                    <dl className="space-y-1">
                      {method.details.map((d) => (
                        <div key={d.key} className="flex justify-between text-sm">
                          <dt className="text-gray-500">{d.key}</dt>
                          <dd className="text-gray-900 font-medium text-right break-all">{d.value}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm border-t border-gray-200 pt-1 mt-1">
                        <dt className="text-gray-500">Amount</dt>
                        <dd className="text-primary-700 font-bold">NPR {total.toLocaleString()}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {method.note && <p className="text-xs text-gray-500 text-center">{method.note}</p>}
              </div>
            )}

            <p className="text-sm text-gray-500 italic text-center">
              After paying, your order stays pending until the store confirms receipt.
            </p>

            <button
              onClick={() => navigate(`/order-success/${orderId}?orderNumber=${orderNumber}`)}
              className="btn-secondary w-full py-3 text-sm"
            >
              I've completed payment → View Order
            </button>
          </>
        )}
      </div>
    </div>
  );
}
