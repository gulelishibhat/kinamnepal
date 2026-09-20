import { Router } from 'express';
import { eq, desc, sql, like, and, gte, lte, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { customers, customerAddresses, orders } from '../db/schema.js';
import { authenticate, requireAdmin, requireCustomer } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { updateCustomerProfileSchema, createAddressSchema, customerQuerySchema } from '@mkelectric/shared';

const router = Router();

// ─── GET /customers/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, requireCustomer, async (req, res, next) => {
  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, req.user!.sub),
      with: { addresses: true },
    });
    if (!customer) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const { passwordHash: _, ...safe } = customer;
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

// ─── PUT /customers/me ────────────────────────────────────────────────────────
router.put('/me', authenticate, requireCustomer, validate(updateCustomerProfileSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').UpdateCustomerProfileInput;
    const updates: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.phone) updates.phone = body.phone;
    if (body.language) updates.language = body.language;
    const [updated] = await db.update(customers).set(updates).where(eq(customers.id, req.user!.sub)).returning();
    if (!updated) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const { passwordHash: _, ...safe } = updated;
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

// ─── POST /customers/me/addresses ─────────────────────────────────────────────
router.post('/me/addresses', authenticate, requireCustomer, validate(createAddressSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').CreateAddressInput;
    if (body.isDefault) {
      await db.update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.customerId, req.user!.sub));
    }
    const [addr] = await db.insert(customerAddresses).values({
      customerId: req.user!.sub,
      label: body.label ?? null,
      street: body.address.street,
      city: body.address.city,
      district: body.address.district,
      isDefault: body.isDefault ?? false,
    }).returning();
    res.status(201).json({ success: true, data: addr });
  } catch (err) { next(err); }
});

router.delete('/me/addresses/:id', authenticate, requireCustomer, async (req, res, next) => {
  try {
    await db.delete(customerAddresses)
      .where(and(eq(customerAddresses.id, req.params['id']!), eq(customerAddresses.customerId, req.user!.sub)));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  ADMIN — customer management
// ════════════════════════════════════════════════════════════════

router.get('/', authenticate, requireAdmin, validate(customerQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as import('@mkelectric/shared').CustomerQuery;
    const offset = (q.page - 1) * q.limit;

    const conditions = [eq(customers.isDeleted, false)];
    if (q.search) {
      const term = `%${q.search}%`;
      conditions.push(or(like(customers.name, term), like(customers.email, term))!);
    }
    if (q.fromDate) conditions.push(gte(customers.createdAt, new Date(q.fromDate)));
    if (q.toDate) conditions.push(lte(customers.createdAt, new Date(q.toDate)));

    const [rows, countResult] = await Promise.all([
      db.query.customers.findMany({
        where: and(...conditions),
        orderBy: [desc(customers.createdAt)],
        limit: q.limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(customers).where(and(...conditions)),
    ]);

    // Attach order counts
    const enriched = await Promise.all(
      rows.map(async (c) => {
        const orderStats = await db
          .select({ count: sql<number>`count(*)`, lastOrder: sql<string>`max(placed_at)` })
          .from(orders)
          .where(eq(orders.customerId, c.id));
        const { passwordHash: _, ...safe } = c;
        return {
          ...safe,
          totalOrders: Number(orderStats[0]?.count ?? 0),
          lastOrderDate: orderStats[0]?.lastOrder ?? null,
        };
      }),
    );

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      success: true,
      data: enriched,
      meta: {
        page: q.page, limit: q.limit, total,
        totalPages: Math.ceil(total / q.limit),
        hasNextPage: offset + q.limit < total,
        hasPrevPage: q.page > 1,
      },
    });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, req.params['id']!),
      with: { addresses: true, orders: { orderBy: [desc(orders.placedAt)], with: { items: true, payment: true } } },
    });
    if (!customer) { res.status(404).json({ success: false, error: 'Customer not found' }); return; }
    const { passwordHash: _, ...safe } = customer;
    res.json({ success: true, data: safe });
  } catch (err) { next(err); }
});

export default router;
