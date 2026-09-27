import { Router } from 'express';
import { eq, and, gte, lte, like, ilike, or, sql, asc, desc, inArray } from 'drizzle-orm';
import multer from 'multer';
import { db } from '../db/index.js';
import { products, productImages, categories } from '../db/schema.js';
import { uploadProductImage } from '../lib/storage.js';
import { authenticate, requireAdmin, requireSeller } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  bulkProductUploadSchema,
} from '@mkelectric/shared';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Strip private seller fields — public responses expose only id + shopName.
type SellerJoin = { id: string; shopName: string } | null | undefined;
function publicSeller(seller: SellerJoin) {
  return seller ? { id: seller.id, shopName: seller.shopName } : null;
}
// The relational `with: { seller: {...} }` column selection used everywhere public.
const publicSellerColumns = { columns: { id: true, shopName: true } } as const;

// Generate a simple unique-ish SKU when the seller leaves it blank.
function generateSku(nameEn: string): string {
  const prefix = (nameEn || 'ITEM').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'ITEM';
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${rand}`;
}

// When size/colour variants are provided, the product's total stock is their sum.
type VariantInput = { size?: string | undefined; color?: string | undefined; stock?: number | undefined };
function sumVariantStock(variants: VariantInput[] | undefined): number | null {
  if (!variants || variants.length === 0) return null;
  return variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
}

// ════════════════════════════════════════════════════════════════
//  CATEGORIES (public read, admin write)
// ════════════════════════════════════════════════════════════════

router.get('/categories', async (req, res, next) => {
  try {
    const cats = await db.query.categories.findMany({ orderBy: (c, { asc }) => [asc(c.sortOrder)] });
    // Live count of active listings per category ("N Ads").
    const counts = await db
      .select({ categoryId: products.categoryId, count: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.isDeleted, false), eq(products.status, 'active')))
      .groupBy(products.categoryId);
    const countMap = new Map(counts.map((c) => [c.categoryId, Number(c.count)]));

    const withCount = cats.map((c) => ({ ...c, adCount: countMap.get(c.id) ?? 0 }));

    // ?flat=true → legacy flat list (all categories). Default → nested tree.
    if (req.query['flat'] === 'true') {
      res.json({ success: true, data: withCount });
      return;
    }

    // Build a nested tree: top-level (parentId null) each with a children array.
    const tops = withCount.filter((c) => !c.parentId);
    const childrenOf = (parentId: string) => withCount.filter((c) => c.parentId === parentId);
    const tree = tops.map((t) => {
      const children = childrenOf(t.id);
      const totalAdCount = children.reduce((s, ch) => s + ch.adCount, t.adCount);
      return { ...t, children, totalAdCount };
    });
    res.json({ success: true, data: tree });
  } catch (err) { next(err); }
});

router.post('/categories', authenticate, requireAdmin, validate(createCategorySchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').CreateCategoryInput;
    const [cat] = await db.insert(categories).values({
      nameEn: body.name.en,
      nameNe: body.name.ne,
      slug: body.slug,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder ?? 0,
    }).returning();
    res.status(201).json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.put('/categories/:id', authenticate, requireAdmin, validate(updateCategorySchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').UpdateCategoryInput;
    const updates: Partial<typeof categories.$inferInsert> = {};
    if (body.name) { updates.nameEn = body.name.en; updates.nameNe = body.name.ne; }
    if (body.slug) updates.slug = body.slug;
    if (body.parentId !== undefined) updates.parentId = body.parentId;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    const [cat] = await db.update(categories).set(updates).where(eq(categories.id, req.params['id']!)).returning();
    if (!cat) { res.status(404).json({ success: false, error: 'Category not found' }); return; }
    res.json({ success: true, data: cat });
  } catch (err) { next(err); }
});

router.delete('/categories/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await db.delete(categories).where(eq(categories.id, req.params['id']!));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  PRODUCTS — public list / detail
// ════════════════════════════════════════════════════════════════

router.get('/', validate(productQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as import('@mkelectric/shared').ProductQuery;

    const conditions = [eq(products.isDeleted, false)];
    if (q.categoryId) conditions.push(eq(products.categoryId, q.categoryId));
    if (q.sellerId) conditions.push(eq(products.sellerId, q.sellerId));
    if (q.condition) conditions.push(eq(products.condition, q.condition));
    if (q.status) conditions.push(eq(products.status, q.status));
    else conditions.push(eq(products.status, 'active'));
    if (q.brand) conditions.push(eq(products.brand, q.brand));
    if (q.inStock) conditions.push(gte(products.stockQuantity, 1));
    if (q.minPrice) conditions.push(gte(products.price, String(q.minPrice)));
    if (q.maxPrice) conditions.push(lte(products.price, String(q.maxPrice)));

    // ── Search: match product name / brand / description AND category or
    //    subcategory name. When a category name matches, we surface products in
    //    that category and (if it's a top-level) all of its subcategories.
    let relevance: ReturnType<typeof sql> | null = null;
    if (q.search) {
      const raw = q.search.trim();
      const term = `%${raw}%`;

      // Category IDs whose own name matches the term.
      const allCats = await db.query.categories.findMany();
      const directCatIds = new Set(
        allCats.filter((c) => c.nameEn.toLowerCase().includes(raw.toLowerCase()) || c.nameNe.includes(raw)).map((c) => c.id),
      );
      // Expand: include children of any matched category (so "Electrical"
      // surfaces products filed under its subcategories too).
      const matchedCatIds = new Set(directCatIds);
      for (const c of allCats) {
        if (c.parentId && directCatIds.has(c.parentId)) matchedCatIds.add(c.id);
      }

      const searchParts = [
        ilike(products.nameEn, term),
        ilike(products.nameNe, term),
        ilike(products.brand, term),
        ilike(products.descriptionEn, term),
        ilike(products.descriptionNe, term),
      ];
      if (matchedCatIds.size > 0) {
        searchParts.push(inArray(products.categoryId, Array.from(matchedCatIds)));
      }
      conditions.push(or(...searchParts)!);

      // Relevance score — lower number = more relevant. Name first, then brand,
      // then category membership, then description.
      relevance = sql`(
        case
          when ${products.nameEn} ilike ${term} or ${products.nameNe} ilike ${term} then 0
          when ${products.brand} ilike ${term} then 1
          when ${matchedCatIds.size > 0 ? inArray(products.categoryId, Array.from(matchedCatIds)) : sql`false`} then 2
          else 3
        end
      )`;
    }

    // Explicit price sorts always win. Otherwise, when searching, rank by
    // relevance (name → brand → category → description), then newest.
    const orderBy =
      q.sort === 'price_asc' ? [asc(products.price)]
      : q.sort === 'price_desc' ? [desc(products.price)]
      : relevance ? [asc(relevance), desc(products.createdAt)]
      : [desc(products.createdAt)];

    const offset = (q.page - 1) * q.limit;

    const [rows, countResult] = await Promise.all([
      db.query.products.findMany({
        where: and(...conditions),
        with: {
          images: { orderBy: (i, { asc }) => [asc(i.sortOrder)], limit: 1 },
          category: true,
          seller: publicSellerColumns,
        },
        orderBy,
        limit: q.limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions)),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r, seller: publicSeller(r.seller) })),
      meta: {
        page: q.page, limit: q.limit, total,
        totalPages: Math.ceil(total / q.limit),
        hasNextPage: offset + q.limit < total,
        hasPrevPage: q.page > 1,
      },
    });
  } catch (err) { next(err); }
});

// ── ADMIN — all products for a given seller (any status, not just active) ──
// Declared before "/:id" so "/admin/..." isn't captured as a product id.
router.get('/admin/by-seller/:sellerId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const sellerId = req.params['sellerId']!;
    const rows = await db.query.products.findMany({
      where: and(eq(products.sellerId, sellerId), eq(products.isDeleted, false)),
      with: {
        images: { orderBy: (i, { asc }) => [asc(i.sortOrder)], limit: 1 },
        category: true,
      },
      orderBy: [desc(products.createdAt)],
    });
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, req.params['id']!), eq(products.isDeleted, false)),
      with: {
        images: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
        category: true,
        seller: publicSellerColumns,
      },
    });
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }
    res.json({ success: true, data: { ...product, seller: publicSeller(product.seller) } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  PRODUCTS — seller write (scoped to the authenticated seller)
// ════════════════════════════════════════════════════════════════

// List the seller's own products (all statuses, not just active).
router.get('/seller/mine', authenticate, requireSeller, validate(productQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query as unknown as import('@mkelectric/shared').ProductQuery;
    const sellerId = req.user!.sub;
    const conditions = [eq(products.isDeleted, false), eq(products.sellerId, sellerId)];
    if (q.categoryId) conditions.push(eq(products.categoryId, q.categoryId));
    if (q.search) {
      const term = `%${q.search}%`;
      conditions.push(or(like(products.nameEn, term), like(products.nameNe, term), like(products.brand, term))!);
    }
    const offset = (q.page - 1) * q.limit;
    const [rows, countResult] = await Promise.all([
      db.query.products.findMany({
        where: and(...conditions),
        with: { images: { orderBy: (i, { asc }) => [asc(i.sortOrder)], limit: 1 }, category: true },
        orderBy: [desc(products.createdAt)],
        limit: q.limit,
        offset,
      }),
      db.select({ count: sql<number>`count(*)` }).from(products).where(and(...conditions)),
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

// ── SELLER — download own inventory as CSV ──────────────────────────────────
// Returns every non-deleted product owned by the seller as a CSV file the
// seller can open in Excel/Sheets. Declared before "/seller/mine/:id" writes.
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Quote if the value contains comma, quote, or newline; escape inner quotes.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get('/seller/mine/export', authenticate, requireSeller, async (req, res, next) => {
  try {
    const sellerId = req.user!.sub;
    const rows = await db.query.products.findMany({
      where: and(eq(products.sellerId, sellerId), eq(products.isDeleted, false)),
      with: { category: true },
      orderBy: [desc(products.createdAt)],
    });

    const header = [
      'SKU', 'Name', 'Brand', 'Category', 'Price', 'Unit',
      'Stock', 'Low Stock Threshold', 'Condition', 'Status', 'Created At',
    ];
    const lines = [header.join(',')];
    for (const p of rows) {
      lines.push([
        p.sku,
        p.nameEn,
        p.brand,
        (p as any).category?.nameEn ?? '',
        p.price,
        p.unit,
        p.stockQuantity,
        p.lowStockThreshold,
        p.condition,
        p.status,
        p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      ].map(csvCell).join(','));
    }
    // Prepend a BOM so Excel opens UTF-8 (Nepali text) correctly.
    const csv = '\uFEFF' + lines.join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${stamp}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

router.post('/seller/mine', authenticate, requireSeller, validate(createProductSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').CreateProductInput;
    const variants = body.variants ?? [];
    const variantStock = sumVariantStock(variants);
    const [product] = await db.insert(products).values({
      nameEn: body.name.en,
      nameNe: body.name.ne,
      descriptionEn: body.description.en,
      descriptionNe: body.description.ne,
      categoryId: body.categoryId,
      sellerId: req.user!.sub, // owned by the authenticated seller
      brand: body.brand,
      sku: (body.sku ?? '').trim() || generateSku(body.name.en),
      price: String(body.price),
      mrp: body.mrp != null ? String(body.mrp) : null,
      discountPercent: body.discountPercent ?? 0,
      unit: body.unit,
      // If variants are given, total stock = sum of their stock.
      stockQuantity: variantStock ?? body.stockQuantity,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      specifications: body.specifications ?? [],
      variants,
      condition: body.condition ?? 'brand_new',
      status: body.status ?? 'active',
    }).returning();
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

// ── Bulk create from CSV rows ──────────────────────────────────────────────
// Accepts { rows: [...] }. Validates each row, maps category by name, creates
// the valid ones for the authenticated seller, and returns a per-row report.
const VALID_UNITS = ['piece', 'meter', 'pack', 'set', 'roll', 'box'];
const CONDITION_MAP: Record<string, string> = {
  'brand new': 'brand_new', 'brand_new': 'brand_new', 'new': 'brand_new',
  'like new': 'like_new', 'like_new': 'like_new',
  'used': 'used', 'second hand': 'used', 'secondhand': 'used',
};

router.post('/seller/bulk', authenticate, requireSeller, validate(bulkProductUploadSchema), async (req, res, next) => {
  try {
    const sellerId = req.user!.sub;
    const { rows } = req.body as import('@mkelectric/shared').BulkProductUploadInput;

    // Load categories once and build a case-insensitive name → id map.
    const cats = await db.query.categories.findMany();
    const catByName = new Map(cats.map((c) => [c.nameEn.trim().toLowerCase(), c.id]));

    let created = 0;
    const failed: Array<{ row: number; title: string; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const rowNum = i + 2; // account for the header row in the CSV (row 1)
      const title = String(r.title ?? '').trim();
      try {
        if (!title) throw new Error('Title is required');
        const catId = catByName.get(String(r.category ?? '').trim().toLowerCase());
        if (!catId) throw new Error(`Unknown category "${r.category}"`);
        const price = Number(r.price);
        if (!price || price <= 0) throw new Error('Price must be greater than 0');
        const stock = Number(r.stock);
        if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number ≥ 0');
        const unit = VALID_UNITS.includes(String(r.unit ?? '').trim().toLowerCase())
          ? String(r.unit).trim().toLowerCase()
          : 'piece';
        const condition = CONDITION_MAP[String(r.condition ?? '').trim().toLowerCase()] ?? 'brand_new';
        const desc = String(r.description ?? '').trim() || title;

        await db.insert(products).values({
          nameEn: title,
          nameNe: title,
          descriptionEn: desc,
          descriptionNe: desc,
          categoryId: catId,
          sellerId,
          brand: String(r.brand ?? '').trim() || '—',
          sku: String(r.sku ?? '').trim() || generateSku(title),
          price: String(price),
          unit: unit as 'piece' | 'meter' | 'pack' | 'set' | 'roll' | 'box',
          stockQuantity: stock,
          lowStockThreshold: 5,
          specifications: [],
          variants: [],
          condition: condition as 'brand_new' | 'like_new' | 'used',
          status: 'active',
        });
        created++;
      } catch (rowErr: any) {
        failed.push({ row: rowNum, title: title || '(no title)', error: rowErr?.message ?? 'Invalid row' });
      }
    }

    res.status(201).json({ success: true, data: { created, failedCount: failed.length, failed } });
  } catch (err) { next(err); }
});

// Helper: confirm a product belongs to the authenticated seller.
async function assertSellerOwnsProduct(productId: string, sellerId: string): Promise<boolean> {
  const p = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.sellerId, sellerId), eq(products.isDeleted, false)),
    columns: { id: true },
  });
  return !!p;
}

router.put('/seller/mine/:id', authenticate, requireSeller, validate(updateProductSchema), async (req, res, next) => {
  try {
    const id = req.params['id']!;
    if (!(await assertSellerOwnsProduct(id, req.user!.sub))) {
      res.status(403).json({ success: false, error: 'You do not own this product' });
      return;
    }
    const body = req.body as import('@mkelectric/shared').UpdateProductInput;
    const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (body.name) { updates.nameEn = body.name.en; updates.nameNe = body.name.ne; }
    if (body.description) { updates.descriptionEn = body.description.en; updates.descriptionNe = body.description.ne; }
    if (body.categoryId) updates.categoryId = body.categoryId;
    if (body.brand) updates.brand = body.brand;
    if (body.sku) updates.sku = body.sku;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.mrp !== undefined) updates.mrp = body.mrp != null ? String(body.mrp) : null;
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.unit) updates.unit = body.unit;
    if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = body.lowStockThreshold;
    if (body.specifications) updates.specifications = body.specifications;
    if (body.condition) updates.condition = body.condition;
    if (body.status) updates.status = body.status;
    // Variants: if provided, save them and set total stock to their sum.
    if (body.variants !== undefined) {
      updates.variants = body.variants;
      const variantStock = sumVariantStock(body.variants);
      if (variantStock !== null) updates.stockQuantity = variantStock;
      else if (body.stockQuantity !== undefined) updates.stockQuantity = body.stockQuantity;
    } else if (body.stockQuantity !== undefined) {
      updates.stockQuantity = body.stockQuantity;
    }

    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.delete('/seller/mine/:id', authenticate, requireSeller, async (req, res, next) => {
  try {
    const id = req.params['id']!;
    if (!(await assertSellerOwnsProduct(id, req.user!.sub))) {
      res.status(403).json({ success: false, error: 'You do not own this product' });
      return;
    }
    await db.update(products).set({ isDeleted: true, updatedAt: new Date() }).where(eq(products.id, id));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

router.post('/seller/mine/:id/images', authenticate, requireSeller, upload.single('image'), async (req, res, next) => {
  try {
    const id = req.params['id']!;
    if (!(await assertSellerOwnsProduct(id, req.user!.sub))) {
      res.status(403).json({ success: false, error: 'You do not own this product' });
      return;
    }
    if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded' }); return; }
    const existingCount = await db.select({ count: sql<number>`count(*)` })
      .from(productImages).where(eq(productImages.productId, id));
    if (Number(existingCount[0]?.count ?? 0) >= 10) {
      res.status(400).json({ success: false, error: 'Maximum 10 images per product' });
      return;
    }
    const result = await uploadProductImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    const [image] = await db.insert(productImages).values({
      productId: id,
      url: result.url,
      sortOrder: Number(existingCount[0]?.count ?? 0),
    }).returning();
    res.status(201).json({ success: true, data: image });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════════════════
//  PRODUCTS — admin write
// ════════════════════════════════════════════════════════════════

router.post('/', authenticate, requireAdmin, validate(createProductSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').CreateProductInput;
    const [product] = await db.insert(products).values({
      nameEn: body.name.en,
      nameNe: body.name.ne,
      descriptionEn: body.description.en,
      descriptionNe: body.description.ne,
      categoryId: body.categoryId,
      brand: body.brand,
      sku: (body.sku ?? '').trim() || generateSku(body.name.en),
      price: String(body.price),
      mrp: body.mrp != null ? String(body.mrp) : null,
      discountPercent: body.discountPercent ?? 0,
      unit: body.unit,
      stockQuantity: body.stockQuantity,
      lowStockThreshold: body.lowStockThreshold ?? 5,
      specifications: body.specifications ?? [],
      variants: body.variants ?? [],
      condition: body.condition ?? 'brand_new',
      status: body.status ?? 'active',
    }).returning();
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, requireAdmin, validate(updateProductSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').UpdateProductInput;
    const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
    if (body.name) { updates.nameEn = body.name.en; updates.nameNe = body.name.ne; }
    if (body.description) { updates.descriptionEn = body.description.en; updates.descriptionNe = body.description.ne; }
    if (body.categoryId) updates.categoryId = body.categoryId;
    if (body.brand) updates.brand = body.brand;
    if (body.sku) updates.sku = body.sku;
    if (body.price !== undefined) updates.price = String(body.price);
    if (body.mrp !== undefined) updates.mrp = body.mrp != null ? String(body.mrp) : null;
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.unit) updates.unit = body.unit;
    if (body.stockQuantity !== undefined) updates.stockQuantity = body.stockQuantity;
    if (body.lowStockThreshold !== undefined) updates.lowStockThreshold = body.lowStockThreshold;
    if (body.specifications) updates.specifications = body.specifications;
    if (body.condition) updates.condition = body.condition;
    if (body.status) updates.status = body.status;

    const [product] = await db.update(products).set(updates).where(eq(products.id, req.params['id']!)).returning();
    if (!product) { res.status(404).json({ success: false, error: 'Product not found' }); return; }
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await db.update(products).set({ isDeleted: true, updatedAt: new Date() }).where(eq(products.id, req.params['id']!));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ─── Image upload ─────────────────────────────────────────────────────────────
router.post('/:id/images', authenticate, requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded' }); return; }

    const existingCount = await db.select({ count: sql<number>`count(*)` })
      .from(productImages).where(eq(productImages.productId, req.params['id']!));
    if (Number(existingCount[0]?.count ?? 0) >= 10) {
      res.status(400).json({ success: false, error: 'Maximum 10 images per product' });
      return;
    }

    const result = await uploadProductImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    const sortOrder = Number(existingCount[0]?.count ?? 0);

    const [image] = await db.insert(productImages).values({
      productId: req.params['id']!,
      url: result.url,
      sortOrder,
    }).returning();

    res.status(201).json({ success: true, data: image });
  } catch (err) { next(err); }
});

router.delete('/:id/images/:imageId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await db.delete(productImages)
      .where(and(eq(productImages.id, req.params['imageId']!), eq(productImages.productId, req.params['id']!)));
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

export default router;
