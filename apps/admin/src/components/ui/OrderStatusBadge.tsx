import Badge from './Badge';
import type { OrderStatus } from '@mkelectric/shared';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment', confirmed: 'Confirmed',
  dispatched: 'Dispatched', delivered: 'Delivered',
  cancelled: 'Cancelled', payment_expired: 'Payment Expired',
};
const STATUS_VARIANT: Record<OrderStatus, 'yellow' | 'blue' | 'purple' | 'green' | 'red' | 'gray'> = {
  pending_payment: 'yellow', confirmed: 'blue', dispatched: 'purple',
  delivered: 'green', cancelled: 'red', payment_expired: 'gray',
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
