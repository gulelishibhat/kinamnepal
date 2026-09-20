import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, payments, orderStatusHistory } from '../db/schema.js';

// eSewa ePay v2 signs a comma-ordered field string with HMAC-SHA256 (base64).
// Sandbox secret is the public test key from eSewa's docs.
export const ESEWA_SANDBOX_SECRET = '8gBm/:&EnhH.1/q';

export function esewaSignature(
  totalAmount: string,
  transactionUuid: string,
  productCode: string,
  secret: string,
): string {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return createHmac('sha256', secret).update(message).digest('base64');
}

/**
 * Marks an order as paid + confirmed (idempotent) and logs the transition.
 * Used by the gateway return/verify callbacks. Returns true if it was newly
 * confirmed, false if the order wasn't awaiting payment (e.g. already done).
 */
export async function markOrderPaid(
  orderNumber: string,
  transactionRef: string | null,
): Promise<{ ok: boolean; orderId?: string }> {
  const order = await db.query.orders.findFirst({ where: eq(orders.orderNumber, orderNumber) });
  if (!order) return { ok: false };
  if (order.status !== 'pending_payment') {
    // Already confirmed/cancelled — treat as success (idempotent) for the redirect.
    return { ok: true, orderId: order.id };
  }

  await db.transaction(async (tx) => {
    await tx.update(payments).set({
      status: 'confirmed',
      transactionRef: transactionRef ?? null,
      confirmedAt: new Date(),
    }).where(eq(payments.orderId, order.id));

    await tx.update(orders).set({ status: 'confirmed', updatedAt: new Date() }).where(eq(orders.id, order.id));

    await tx.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'pending_payment',
      toStatus: 'confirmed',
      changedBy: null,
      note: 'Payment confirmed via gateway',
    });
  });

  return { ok: true, orderId: order.id };
}
