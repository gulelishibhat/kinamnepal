import { Router } from 'express';
import { eq, and, desc, gte, lte, like, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, orderItems, payments, orderStatusHistory, products, productImages, customers } from '../db/schema.js';
import { broadcastToAdmins } from '../lib/sse.js';
import { archiveOrder } from '../lib/order-archive.js';
import { authenticate, requireAdmin, optionalAuth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  checkoutSchema,
  guestCheckoutSchema,
  updateOrderStatusSchema,
  confirmPaymentSchema,
  trackOrderSchema,
  orderQuerySchema,
} from '@mkelectric/shared';
import type { CheckoutInput, GuestCheckoutInput, OrderQuery } from '@mkelectric/shared';

const router = Router();

// ─── Generate order number ────────────────────────────────────────────────────
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(gte(orders.placedAt, new Date(`${year}-01-01`)));
  const seq = (Number(result[0]?.count ?? 0) + 1).toString().padStart(6, '0');
  return `MKE-${year}-${seq}`;
}

// ─── Allowed status transitions ───────────────────────────────────────────────
const TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['confirmed', 'cancelled', 'payment_expired'],
  confirmed: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
};

function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ════════════════════════════════════════════════════════════════
//  CUSTOMER — place order
// ════════════════════════════════════════════════════════════════

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    // Only a CUSTOMER token attributes the order to a customer account. A
    // seller/admin token (someone browsing the storefront while logged into
    // another portal) is treated as a guest checkout — otherwise we'd try to
    // set customer_id to a non-customer id and hit a foreign-key error (500).
    const isCustomer = req.user?.role === 'customer';
    // Verify the customer actually exists (defensive: stale token after a
    // deleted account would otherwise also cause an FK violation).
    let customerId: string | null = null;
    if (isCustomer) {
      const c = await db.query.customers.findFirst({
        where: and(eq(customers.id, req.user!.sub), eq(customers.isDeleted, false)),
        columns: { id: true },
      });
      customerId = c?.id ?? null;
    }
    const isLoggedIn = !!customerId;

    const schema = isLoggedIn ? checkoutSchema : guestCheckoutSchema;
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        success: false,
        error: isLoggedIn
          ? 'Validation failed'
          : 'To place this order please provide your name and phone, or log in with a customer account.',
        details: parseResult.error.flatten().fieldErrors,
      });
      return;
    }
    const body = parseResult.data as CheckoutInput & GuestCheckoutInput;

    // Fetch cart items from body (customer sends cart in request)
    const cartItems: Array<{ productId: string; quantity: number; variant?: string }> = req.body.items ?? [];
    if (!cartItems.length) {
      res.status(400).json({ success: false, error: 'Cart is empty' });
      return;
    }

    // Match a variant row to a selected label ("size / color" joined).
    const variantMatches = (v: { size?: string | null; color?: string | null }, label: string) => {
      const composed = [v.size, v.color].filter(Boolean).join(' / ');
      return composed === label;
    };

    // Validate stock and compute totals
    let subtotal = 0;
    type LineItemInput = Omit<typeof orderItems.$inferInsert, 'orderId' | 'id'> & { productImage?: string | null };
    const lineItems: LineItemInput[] = [];

    for (const item of cartItems) {
      const product = await db.query.products.findFirst({
        where: and(eq(products.id, item.productId), eq(products.isDeleted, false)),
        with: { images: { limit: 1, orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
      });
      if (!product) {
        res.status(400).json({ success: false, error: `Product ${item.productId} not found` });
        return;
      }
      // Resolve the selected variant (if any) for per-variant price + stock.
      const productVariants = (product.variants as Array<{ size?: string; color?: string; stock?: number; price?: number }> | null) ?? [];
      const selectedVariant = item.variant
        ? productVariants.find((v) => variantMatches(v, item.variant!))
        : undefined;

      // Stock check: against the variant when selected, else the product.
      const availableStock = selectedVariant ? Number(selectedVariant.stock ?? 0) : product.stockQuantity;
      if (availableStock < item.quantity) {
        res.status(409).json({ success: false, error: `Insufficient stock for "${product.nameEn}"${item.variant ? ` (${item.variant})` : ''}` });
        return;
      }

      // Price: the selected variant's price when it has one, else product price.
      const unitPrice = selectedVariant?.price != null ? Number(selectedVariant.price) : Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const variantSuffix = item.variant ? ` (${item.variant})` : '';
      lineItems.push({
        productId: product.id,
        sellerId: product.sellerId ?? null, // attribute the line to its seller
        productNameEn: product.nameEn + variantSuffix,
        productNameNe: product.nameNe + variantSuffix,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: String(unitPrice),
        lineTotal: String(lineTotal),
        productImage: product.images[0]?.url ?? null,
      });
    }

    const total = subtotal; // no delivery fee in MVP
    const orderNumber = await generateOrderNumber();

    // Payment choice. COD (cash on delivery) auto-confirms the order into the
    // fulfillment queue — no QR wait. Online keeps the pending_payment/QR flow.
    const isCod = body.paymentType === 'cod';
    const initialStatus = isCod ? 'confirmed' : 'pending_payment';

    // Atomic insert
    const [order] = await db.transaction(async (tx) => {
      const [newOrder] = await tx.insert(orders).values({
        orderNumber,
        customerId,
        guestName: body.guestName ?? null,
        guestPhone: body.guestPhone ?? null,
        guestEmail: body.guestEmail ?? null,
        deliveryAddress: body.deliveryAddress,
        status: initialStatus,
        subtotal: String(subtotal),
        total: String(total),
        notes: body.notes ?? null,
      }).returning();

      if (!newOrder) throw new Error('Order creation failed');

      await tx.insert(orderItems).values(
        lineItems.map((li) => ({ orderId: newOrder.id, ...li }) as typeof orderItems.$inferInsert),
      );

      // Record initial payment. COD → method 'cash', collected on delivery (no
      // QR expiry). Online → method 'qr', pending, 15-min QR window.
      await tx.insert(payments).values({
        orderId: newOrder.id,
        amount: String(total),
        paymentMethod: isCod ? 'cash' : 'qr',
        status: 'pending',
        qrExpiresAt: isCod ? null : new Date(Date.now() + 15 * 60 * 1000),
      });

      // Log status history
      await tx.insert(orderStatusHistory).values({
        orderId: newOrder.id,
        fromStatus: null,
        toStatus: initialStatus,
        changedBy: null,
        note: isCod ? 'Order placed (Cash on Delivery)' : 'Order placed',
      });

      // Decrement stock. Always reduce the product-level total; when a variant
      // was selected, also decrement that variant's stock inside the jsonb.
      for (const item of cartItems) {
        if (item.variant) {
          const prod = await tx.query.products.findFirst({
            where: eq(products.id, item.productId),
            columns: { variants: true },
          });
          const vs = (prod?.variants as Array<{ size?: string; color?: string; stock?: number }> | null) ?? [];
          const nextVs = vs.map((v) =>
            variantMatches(v, item.variant!) ? { ...v, stock: Math.max(0, Number(v.stock ?? 0) - item.quantity) } : v,
          );
          await tx
            .update(products)
            .set({ variants: nextVs, stockQuantity: sql`stock_quantity - ${item.quantity}`, updatedAt: new Date() })
            .where(eq(products.id, item.productId));
        } else {
          await tx
            .update(products)
            .set({ stockQuantity: sql`stock_quantity - ${item.quantity}`, updatedAt: new Date() })
            .where(eq(products.id, item.productId));
        }
      }

      return [newOrder];
    });

    // Post-order side effects (non-blocking)
    const customerName = customerId
      ? (await db.query.customers.findFirst({ where: eq(customers.id, customerId) }))?.name ?? 'Customer'
      : (body.guestName ?? 'Guest');

    broadcastToAdmins('new_order', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      total,
      placedAt: order.placedAt.toISOString(),
      status: initialStatus,
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total,
        paymentType: isCod ? 'cod' : 'online',
        status: initialStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /orders — customer's own orders ──────────────────────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const myOrders = await db.query.orders.findMany({
      where: and(eq(orders.customerId, req.user!.sub), eq(orders.isDeleted, false)),
      orderBy: [desc(orders.placedAt)],
      with: { items: true, payment: true },
    });
    res.json({ success: true, data: myOrders });
  } catch (err) { next(err); }
});

// ─── GET /orders/track — guest order tracking ─────────────────────────────────
router.get('/track', validate(trackOrderSchema, 'query'), async (req, res, next) => {
  try {
    const { orderNumber, phone } = req.query as unknown as import('@mkelectric/shared').TrackOrderInput;
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.orderNumber, orderNumber), eq(orders.guestPhone, phone), eq(orders.isDeleted, false)),
      with: { items: true, payment: true, statusHistory: true },
    });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// ─── GET /orders/:id — customer own order detail ──────────────────────────────
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, req.params['id']!), eq(orders.isDeleted, false)),
      with: { items: true, payment: true, statusHistory: true },
    });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }

    // Only owner or admin
    if (req.user?.role === 'admin') {
      res.json({ success: true, data: order });
      return;
    }
    if (req.user && order.customerId === req.user.sub) {
      res.json({ success: true, data: order });
      return;
    }
    res.status(403).json({ success: false, error: 'Access denied' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN — order management
// ════════════════════════════════════════════════════════════════

router.get('/admin/all', authenticate, requireAdmin, validate(orderQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as OrderQuery;
    const conditions = [eq(orders.isDeleted, q.includeDeleted ? true : false)];
    if (!q.includeDeleted) conditions[0] = eq(orders.isDeleted, false);
    if (q.status) conditions.push(eq(orders.status, q.status));
    if (q.search) {
      const term = `%${q.search}%`;
      conditions.push(or(like(orders.orderNumber, term), like(orders.guestName!, term))!);
    }
    if (q.fromDate) conditions.push(gte(orders.placedAt, new Date(q.fromDate)));
    if (q.toDate) conditions.push(lte(orders.placedAt, new Date(q.toDate)));

    const offset = (q.page - 1) * q.limit;
    const [rows, countResult] = await Promise.all([
      db.query.orders.findMany({
        where: and(...conditions),
        orderBy: [desc(orders.placedAt)],
        with: { items: true, payment: true, customer: true },
        limit: q.limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(orders).where(and(...conditions)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      success: true,
      data: rows,
      meta: {
        page: q.page, limit: q.limit, total,
        totalPages: Math.ceil(total / q.limit),
        hasNextPage: offset + q.limit < total,
        hasPrevPage: q.page > 1,
      },
    });
  } catch (err) { next(err); }
});

// ─── Admin: full single-order detail (includes the customer relation) ─────────
// Registered AFTER "/admin/all" so the literal "all" path isn't captured as :id.
// The public "/:id" route omits the customer join; admins need the buyer's full
// contact + saved addresses for fulfilment, so this endpoint includes them.
router.get('/admin/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, req.params['id']!), eq(orders.isDeleted, false)),
      with: {
        items: true,
        payment: true,
        statusHistory: true,
        customer: {
          with: { addresses: true },
        },
      },
    });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// ─── Admin: update order status ───────────────────────────────────────────────
router.patch('/:id/status', authenticate, requireAdmin, validate(updateOrderStatusSchema), async (req, res, next) => {
  try {
    const { status: newStatus, note } = req.body as import('@mkelectric/shared').UpdateOrderStatusInput;
    const order = await db.query.orders.findFirst({ where: eq(orders.id, req.params['id']!) });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }

    if (!canTransition(order.status, newStatus)) {
      res.status(422).json({ success: false, error: `Cannot transition from ${order.status} to ${newStatus}` });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: newStatus,
        changedBy: req.user!.sub,
        note: note ?? null,
      });

      // Restore stock on cancel
      if (newStatus === 'cancelled') {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        for (const item of items) {
          await tx.update(products)
            .set({ stockQuantity: sql`stock_quantity + ${item.quantity}`, updatedAt: new Date() })
            .where(eq(products.id, item.productId));
        }
      }
    });

    const updated = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: { items: true, payment: true, statusHistory: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Admin: confirm payment ───────────────────────────────────────────────────
router.patch('/:id/confirm-payment', authenticate, requireAdmin, validate(confirmPaymentSchema), async (req, res, next) => {
  try {
    const { transactionRef } = req.body as import('@mkelectric/shared').ConfirmPaymentInput;
    const order = await db.query.orders.findFirst({ where: eq(orders.id, req.params['id']!) });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }
    if (order.status !== 'pending_payment') {
      res.status(422).json({ success: false, error: 'Order is not awaiting payment' });
      return;
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
        changedBy: req.user!.sub,
        note: 'Payment confirmed',
      });
    });

    // Order is now complete (paid) — archive a JSON snapshot to S3 / disk so the
    // record is retained independently of the DB and can be referenced later.
    const fullOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: { items: true, payment: true, statusHistory: true },
    });
    if (fullOrder) {
      archiveOrder(fullOrder.orderNumber, { ...fullOrder, transactionRef: transactionRef ?? null });
    }

    res.json({ success: true, data: { message: 'Payment confirmed' } });
  } catch (err) { next(err); }
});

// ─── Admin: soft delete order ─────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await db.update(orders)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(orders.id, req.params['id']!));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

export default router;
