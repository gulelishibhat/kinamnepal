import { Router } from 'express';
import { eq, gte, sql, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, customers, products } from '../db/schema.js';
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /dashboard/summary
 * Returns headline stats for the admin dashboard grid.
 */
router.get('/summary', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayOrdersResult,
      pendingOrdersResult,
      lowStockResult,
      newCustomersResult,
      recentOrders,
    ] = await Promise.all([
      // Today's orders count + revenue
      db
        .select({
          count: sql<number>`count(*)`,
          revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
        })
        .from(orders)
        .where(and(gte(orders.placedAt, todayStart), eq(orders.isDeleted, false))),

      // Pending orders count
      db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.status, 'pending_payment'), eq(orders.isDeleted, false))),

      // Low stock product count
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(
          and(
            eq(products.isDeleted, false),
            eq(products.status, 'active'),
            sql`stock_quantity <= low_stock_threshold`,
          ),
        ),

      // New customers today
      db
        .select({ count: sql<number>`count(*)` })
        .from(customers)
        .where(and(gte(customers.createdAt, todayStart), eq(customers.isDeleted, false))),

      // Recent 20 orders
      db.query.orders.findMany({
        where: eq(orders.isDeleted, false),
        orderBy: (o, { desc }) => [desc(o.placedAt)],
        limit: 20,
        with: { payment: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        todayOrders: {
          count: Number(todayOrdersResult[0]?.count ?? 0),
          revenue: Number(todayOrdersResult[0]?.revenue ?? 0),
        },
        pendingOrders: Number(pendingOrdersResult[0]?.count ?? 0),
        lowStockAlerts: Number(lowStockResult[0]?.count ?? 0),
        newCustomers: Number(newCustomersResult[0]?.count ?? 0),
        recentOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
