import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAdminOrder, useUpdateOrderStatus, useConfirmPayment } from '@/hooks/useOrders';
import OrderStatusBadge from '@/components/ui/OrderStatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import type { OrderStatus } from '@mkelectric/shared';

const TRANSITIONS: Record<string, Array<{ to: OrderStatus; label: string; variant: string }>> = {
  pending_payment: [
    { to: 'confirmed', label: 'Confirm Payment', variant: 'btn-success' },
    { to: 'cancelled', label: 'Cancel Order', variant: 'btn-danger' },
  ],
  confirmed: [
    { to: 'dispatched', label: 'Mark Dispatched', variant: 'btn-primary' },
    { to: 'cancelled', label: 'Cancel Order', variant: 'btn-danger' },
  ],
  dispatched: [
    { to: 'delivered', label: 'Mark Delivered', variant: 'btn-success' },
  ],
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useAdminOrder(id!);
  const updateStatus = useUpdateOrderStatus(id!);
  const confirmPayment = useConfirmPayment(id!);
  const [pendingAction, setPendingAction] = useState<{ to: OrderStatus; label: string } | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  if (isLoading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-24 text-gray-400">Order not found. <Link to="/orders" className="text-primary-700 underline">Back</Link></div>;

  const actions = TRANSITIONS[order.status] ?? [];
  const customerName = order.customer?.name ?? order.guestName ?? 'Guest';
  // Phone is the primary way the admin contacts the customer (no email flow).
  const customerPhone = order.guestPhone ?? order.customer?.phone ?? null;
  const customerEmail = order.customer?.email ?? order.guestEmail ?? null;

  function handleAction(action: typeof pendingAction) {
    if (!action) return;
    if (action.to === 'confirmed' && order.status === 'pending_payment') {
      setShowPaymentModal(true);
    } else {
      setPendingAction(action);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/orders" className="text-sm text-gray-500 hover:text-gray-700">← Orders</Link>
        <h1 className="text-xl font-bold text-gray-900">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status as OrderStatus} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Items */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                  {item.productImage && <img src={item.productImage} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{item.productNameEn}</p>
                    <p className="text-xs text-gray-500">SKU: {item.sku} · ×{item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">NPR {Number(item.lineTotal).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">@ {Number(item.unitPrice).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>NPR {Number(order.total).toLocaleString()}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Status Timeline</h2>
            <ol className="relative border-l border-gray-200 space-y-4 ml-3">
              {order.statusHistory?.map((h: any) => (
                <li key={h.id} className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary-600 border-2 border-white" />
                  <p className="text-sm font-medium text-gray-900">
                    {h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(h.changedAt).toLocaleString()}</p>
                  {h.note && <p className="text-xs text-gray-500 italic mt-0.5">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Customer</h2>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${order.customer?.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {order.customer?.id ? 'Registered' : 'Guest'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-800">{customerName}</p>

            {/* Phone — primary contact. Prominent + click-to-call. */}
            {customerPhone ? (
              <a
                href={`tel:${customerPhone}`}
                className="mt-2 flex items-center gap-2 rounded-lg bg-primary-50 border border-primary-200 px-3 py-2 text-primary-800 font-semibold hover:bg-primary-100 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {customerPhone}
              </a>
            ) : (
              <p className="mt-2 text-sm text-gray-400">No phone on file</p>
            )}

            {customerEmail && <p className="mt-2 text-sm text-gray-500">{customerEmail}</p>}

            {order.customer?.id && (
              <Link to={`/customers/${order.customer.id}`} className="text-xs text-primary-700 hover:underline mt-2 inline-block">
                View profile →
              </Link>
            )}
          </div>

          {/* Delivery */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Delivery Address</h2>
            <p className="text-sm text-gray-700">{order.deliveryAddress.street}</p>
            <p className="text-sm text-gray-700">{order.deliveryAddress.city}, {order.deliveryAddress.district}</p>
            {order.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Customer note</p>
                <p className="text-sm text-gray-700 italic">{order.notes}</p>
              </div>
            )}
            {order.customer?.addresses?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Saved addresses on account</p>
                <div className="space-y-1">
                  {order.customer.addresses.map((a: any) => (
                    <p key={a.id} className="text-xs text-gray-500">
                      {a.label ? `${a.label}: ` : ''}{a.street}, {a.city}, {a.district}
                      {a.isDefault ? ' (default)' : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          {(() => {
            const isCod = order.payment?.paymentMethod === 'cash';
            const methodLabel = isCod
              ? 'Cash on Delivery'
              : order.payment?.paymentMethod
                ? 'Online'
                : '—';
            const codUnpaid = isCod && order.payment?.status !== 'confirmed';
            return (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Payment</h2>

                {/* COD collection banner for the rider/ops */}
                {codUnpaid && (
                  <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">Collect on delivery</p>
                    <p className="text-lg font-bold text-amber-900">NPR {Number(order.total).toLocaleString()}</p>
                  </div>
                )}

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-medium">{methodLabel}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Status</span>
                    <span className={order.payment?.status === 'confirmed' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                      {isCod && order.payment?.status !== 'confirmed' ? 'to collect' : order.payment?.status ?? '—'}
                    </span>
                  </div>
                  {order.payment?.transactionRef && (
                    <div className="flex justify-between"><span className="text-gray-500">Ref</span><span className="font-mono text-xs">{order.payment.transactionRef}</span></div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Actions */}
          {actions.length > 0 && (
            <div className="card p-5 space-y-2">
              <h2 className="font-semibold text-gray-900 mb-1">Actions</h2>
              {actions.map((action) => (
                <button
                  key={action.to}
                  onClick={() => handleAction(action)}
                  className={`${action.variant} w-full py-2 text-sm`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm payment modal */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Confirm Payment">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Enter the transaction reference (optional) and confirm that payment of <strong>NPR {Number(order.total).toLocaleString()}</strong> has been received.</p>
          <input
            className="input"
            placeholder="Transaction reference (optional)"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowPaymentModal(false)} className="btn-secondary btn-sm px-4 py-2">Cancel</button>
            <button
              onClick={() => {
                confirmPayment.mutate({ transactionRef: transactionRef || undefined }, {
                  onSuccess: () => setShowPaymentModal(false),
                });
              }}
              disabled={confirmPayment.isPending}
              className="btn-success btn-sm px-4 py-2"
            >
              {confirmPayment.isPending ? 'Confirming…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Status change confirmation */}
      <ConfirmDialog
        open={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) {
            updateStatus.mutate({ status: pendingAction.to }, { onSuccess: () => setPendingAction(null) });
          }
        }}
        title={pendingAction?.label ?? ''}
        message={`Are you sure you want to ${pendingAction?.label?.toLowerCase()}?`}
        confirmLabel={pendingAction?.label ?? 'Confirm'}
        danger={pendingAction?.to === 'cancelled'}
        loading={updateStatus.isPending}
      />
    </div>
  );
}
