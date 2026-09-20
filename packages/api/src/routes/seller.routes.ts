import { Router } from 'express';
import { eq, and, sql, desc, inArray, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sellers, products, orders, orderItems } from '../db/schema.js';
import { authenticate, requireSeller, requireAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateSellerProfileSchema } from '@mkelectric/shared';

const router = Router();

// ════════════════════════════════════════════════════════════════
//  ADMIN — full seller directory + profile (private fields visible).
//  These are declared BEFORE the public "/:id" route so "/admin/..."
//  is not swallowed by the :id param.
// ════════════════════════════════════════════════════════════════

// List every seller with their listing counts.
router.get('/admin/all', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.query.sellers.findMany({
      orderBy: (s, { desc: d }) => [d(s.createdAt)],
    });

    // Active + total listing counts per seller in one grouped query.
    const counts = await db
      .select({
        sellerId: products.sellerId,
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${products.status} = 'active')`,
      })
      .from(products)
      .where(eq(products.isDeleted, false))
      .groupBy(products.sellerId);
    const countMap = new Map(counts.map((c) => [c.sellerId, c]));

    const data = rows.map(({ passwordHash: _pw, ...s }) => {
      const c = countMap.get(s.id);
      return {
        ...s,
        productCount: Number(c?.total ?? 0),
        activeProductCount: Number(c?.active ?? 0),
      };
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Full profile of a single seller (admin sees private contact/address too).
router.get('/admin/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const seller = await db.query.sellers.findFirst({
      where: eq(sellers.id, req.params['id']!),
    });
    if (!seller) { res.status(404).json({ success: false, error: 'Seller not found' }); return; }
    const { passwordHash: _pw, ...safe } = seller;

    const counts = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${products.status} = 'active')`,
      })
      .from(products)
      .where(and(eq(products.sellerId, seller.id), eq(products.isDeleted, false)));

    res.json({
      success: true,
      data: {
        ...safe,
        productCount: Number(counts[0]?.total ?? 0),
        activeProductCount: Number(counts[0]?.active ?? 0),
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  PUBLIC — seller shop profile (private fields NEVER exposed)
// ════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res, next) => {
  try {
    const seller = await db.query.sellers.findFirst({
      where: and(eq(sellers.id, req.params['id']!), eq(sellers.isActive, true)),
      // Only public columns — ownerName/phone/address are intentionally omitted.
      columns: { id: true, shopName: true, shopDescription: true, createdAt: true },
    });
    if (!seller) { res.status(404).json({ success: false, error: 'Seller not found' }); return; }

    // Count of active listings ("N Ads" on the storefront).
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.sellerId, seller.id), eq(products.isDeleted, false), eq(products.status, 'active')));

    res.json({
      success: true,
      data: {
        id: seller.id,
        shopName: seller.shopName,
        shopDescription: seller.shopDescription,
        createdAt: seller.createdAt,
        adCount: Number(countRes[0]?.count ?? 0),
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  SELLER — own profile
// ════════════════════════════════════════════════════════════════
router.get('/me/profile', authenticate, requireSeller, async (req, res, next) => {
  try {
    const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, req.user!.sub) });
    if (!seller) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const { passwordHash: _pw, ...safe } = seller;
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

router.put('/me/profile', authenticate, requireSeller, validate(updateSellerProfileSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').UpdateSellerProfileInput;
    const updates: Partial<typeof sellers.$inferInsert> = { updatedAt: new Date() };
    if (body.shopName !== undefined) updates.shopName = body.shopName;
    if (body.shopDescription !== undefined) updates.shopDescription = body.shopDescription;
    if (body.ownerName !== undefined) updates.ownerName = body.ownerName;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.addressStreet !== undefined) updates.addressStreet = body.addressStreet;
    if (body.addressCity !== undefined) updates.addressCity = body.addressCity;
    if (body.addressDistrict !== undefined) updates.addressDistrict = body.addressDistrict;

    const [updated] = await db.update(sellers).set(updates).where(eq(sellers.id, req.user!.sub)).returning();
    if (!updated) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const { passwordHash: _pw, ...safe } = updated;
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  SELLER — dashboard summary
// ════════════════════════════════════════════════════════════════
router.get('/me/dashboard', authenticate, requireSeller, async (req, res, next) => {
  try {
    const sellerId = req.user!.sub;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Distinct orders that contain at least one of this seller's items.
    const [activeListings, lowStock, itemsToday, recentItems] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(products)
        .where(and(eq(products.sellerId, sellerId), eq(products.isDeleted, false), eq(products.status, 'active'))),
      db.select({ count: sql<number>`count(*)` }).from(products)
        .where(and(eq(products.sellerId, sellerId), eq(products.isDeleted, false), sql`stock_quantity <= low_stock_threshold`)),
      db.select({
        count: sql<number>`count(distinct ${orderItems.orderId})`,
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}::numeric), 0)`,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orderItems.sellerId, sellerId), gte(orders.placedAt, todayStart), eq(orders.isDeleted, false))),
      db.select({
        orderId: orderItems.orderId,
        orderNumber: orders.orderNumber,
        placedAt: orders.placedAt,
        status: orders.status,
        productNameEn: orderItems.productNameEn,
        quantity: orderItems.quantity,
        lineTotal: orderItems.lineTotal,
      }).from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orderItems.sellerId, sellerId), eq(orders.isDeleted, false)))
        .orderBy(desc(orders.placedAt))
        .limit(10),
    ]);

    res.json({
      success: true,
      data: {
        activeListings: Number(activeListings[0]?.count ?? 0),
        lowStock: Number(lowStock[0]?.count ?? 0),
        todayOrders: Number(itemsToday[0]?.count ?? 0),
        todayRevenue: Number(itemsToday[0]?.revenue ?? 0),
        recentItems,
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  SELLER — orders containing this seller's items (only their lines)
// ════════════════════════════════════════════════════════════════
router.get('/me/orders', authenticate, requireSeller, async (req, res, next) => {
  try {
    const sellerId = req.user!.sub;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '25'), 10)));
    const offset = (page - 1) * limit;

    // Orders that include at least one of this seller's items.
    const orderIdRows = await db
      .selectDistinct({ orderId: orderItems.orderId })
      .from(orderItems)
      .where(eq(orderItems.sellerId, sellerId));
    const orderIds = orderIdRows.map((r) => r.orderId);

    if (orderIds.length === 0) {
      res.json({ success: true, data: [], meta: { page, limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } });
      return;
    }

    const total = orderIds.length;
    const pageOrders = await db.query.orders.findMany({
      where: and(inArray(orders.id, orderIds), eq(orders.isDeleted, false)),
      orderBy: [desc(orders.placedAt)],
      limit,
      offset,
    });

    // Attach ONLY this seller's line items. Customer identity (name, phone,
    // delivery address) is intentionally NOT exposed to sellers — they only
    // get the order confirmation number + their product details.
    const result = await Promise.all(
      pageOrders.map(async (o) => {
        const items = await db.select().from(orderItems)
          .where(and(eq(orderItems.orderId, o.id), eq(orderItems.sellerId, sellerId)));
        const sellerSubtotal = items.reduce((s, it) => s + Number(it.lineTotal), 0);
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          placedAt: o.placedAt,
          items,
          sellerSubtotal,
        };
      }),
    );

    res.json({
      success: true,
      data: result,
      meta: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: offset + limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) { next(err); }
});

// ─── SELLER — single order detail (their items only) ────────────────────────────
router.get('/me/orders/:id', authenticate, requireSeller, async (req, res, next) => {
  try {
    const sellerId = req.user!.sub;
    const orderId = req.params['id']!;

    const items = await db.select().from(orderItems)
      .where(and(eq(orderItems.orderId, orderId), eq(orderItems.sellerId, sellerId)));
    if (items.length === 0) {
      res.status(404).json({ success: false, error: 'Order not found for this seller' });
      return;
    }
    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.isDeleted, false)),
      with: { statusHistory: true },
    });
    if (!order) { res.status(404).json({ success: false, error: 'Order not found' }); return; }

    // Customer identity (name, phone, delivery address, order notes) is
    // intentionally withheld from sellers. They see the confirmation number,
    // status, their line items, and their subtotal only.
    res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.placedAt,
        items,
        sellerSubtotal: items.reduce((s, it) => s + Number(it.lineTotal), 0),
        statusHistory: order.statusHistory,
      },
    });
  } catch (err) { next(err); }
});

export default router;
