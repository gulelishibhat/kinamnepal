import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import type { OrderStatus } from '@mkelectric/shared';

const variantMap: Record<OrderStatus, 'yellow' | 'blue' | 'purple' | 'green' | 'red' | 'gray'> = {
  pending_payment: 'yellow',
  confirmed: 'blue',
  dispatched: 'purple',
  delivered: 'green',
  cancelled: 'red',
  payment_expired: 'gray',
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={variantMap[status]}>
      {t(`order.status.${status}`)}
    </Badge>
  );
}
