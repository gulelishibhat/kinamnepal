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
    if (q.categoryId) {
      // If the selected category is a PARENT, include products in all of its
      // subcategories too (products now live in subcategories, not the parent).
      const kids = await db.query.categories.findMany({
        where: eq(categories.parentId, q.categoryId),
        columns: { id: true },
      });
      if (kids.length > 0) {
        conditions.push(inArray(products.categoryId, [q.categoryId, ...kids.map((k) => k.id)]));
      } else {
        conditions.push(eq(products.categoryId, q.categoryId));
      }
    }
    if (q.sellerId) conditions.push(eq(products.sellerId, q.sellerId));
    if (q.condition) conditions.push(eq(products.condition, q.condition));
    if (q.status) conditions.push(eq(products.status, q.status));
    else conditions.push(eq(products.status, 'active'));
    if (q.brand) conditions.push(eq(products.brand, q.brand));
    if (q.inStock) conditions.push(gte(products.stockQuantity, 1));
    if (q.minPrice) conditions.push(gte(products.price, String(q.minPrice)));
    if (q.maxPrice) conditions.push(lte(products.price, String(q.maxPrice)));

    // ── Search: token-based with OR. The query is split into words; a product
    //    matches if it contains ANY word in its name / brand / description /
    //    category name — so "Himstar bulb" matches "LED Bulb himstar 5W" even
    //    with the words in a different order. Category matches also pull in that
    //    category's subcategories. Relevance floats exact-phrase and
    //    all-words-in-name matches to the top.
    let relevance: ReturnType<typeof sql> | null = null;
    if (q.search && q.search.trim()) {
      const raw = q.search.trim();
      const phrase = `%${raw}%`;
      // Distinct, non-empty lowercase tokens (cap to a sane number).
      const tokens = Array.from(new Set(raw.toLowerCase().split(/\s+/).filter(Boolean))).slice(0, 8);

      const allCats = await db.query.categories.findMany();
      // For a token, the set of category ids whose name matches it, expanded to
      // include children of any matched (top-level) category.
      const catIdsForToken = (tok: string): string[] => {
        const direct = new Set(
          allCats.filter((c) => c.nameEn.toLowerCase().includes(tok) || c.nameNe.includes(tok)).map((c) => c.id),
        );
        const withKids = new Set(direct);
        for (const c of allCats) if (c.parentId && direct.has(c.parentId)) withKids.add(c.id);
        return Array.from(withKids);
      };

      // Each token → an OR across fields (name/brand/description/category).
      // Tokens are OR-ed together too: a product matches if it contains ANY of
      // the words. Relevance (below) floats items matching more words / the
      // exact phrase to the top.
      const tokenClauses = [] as ReturnType<typeof or>[];
      for (const tok of tokens) {
        const t = `%${tok}%`;
        const parts = [
          ilike(products.nameEn, t),
          ilike(products.nameNe, t),
          ilike(products.brand, t),
          ilike(products.descriptionEn, t),
          ilike(products.descriptionNe, t),
        ];
        const catIds = catIdsForToken(tok);
        if (catIds.length > 0) parts.push(inArray(products.categoryId, catIds));
        tokenClauses.push(or(...parts)!);
      }
      // Also allow the full phrase itself (covers multi-word category names).
      tokenClauses.push(or(ilike(products.nameEn, phrase), ilike(products.nameNe, phrase))!);
      conditions.push(or(...tokenClauses)!);

      // Relevance: exact phrase in name is best, then all tokens in name, then
      // brand/phrase, then everything else. Lower = more relevant.
      const nameTokenHits = tokens.map((tok) => sql`(case when ${products.nameEn} ilike ${`%${tok}%`} then 1 else 0 end)`);
      const nameHitSum = nameTokenHits.length
        ? sql.join(nameTokenHits, sql` + `)
        : sql`0`;
      relevance = sql`(
        case
          when ${products.nameEn} ilike ${phrase} or ${products.nameNe} ilike ${phrase} then 0
          when (${nameHitSum}) = ${tokens.length} then 1
          when ${products.brand} ilike ${phrase} then 2
          when (${nameHitSum}) > 0 then 3
          else 4
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

    // Load categories once and build a case-insensitive lookup that accepts:
    //   • a hierarchical label "Parent → Child" (preferred for subcategories)
    //   • a plain subcategory name (only when unambiguous across the tree)
    //   • a top-level category name
    const cats = await db.query.categories.findMany();
    const catById = new Map(cats.map((c) => [c.id, c]));
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    // Count how many categories share each plain name (to detect ambiguity).
    const nameCount = new Map<string, number>();
    for (const c of cats) nameCount.set(norm(c.nameEn), (nameCount.get(norm(c.nameEn)) ?? 0) + 1);

    const catByName = new Map<string, string>();
    for (const c of cats) {
      const plain = norm(c.nameEn);
      // Hierarchical label "Parent → Child" / "Parent > Child" / "Parent - Child".
      if (c.parentId) {
        const parent = catById.get(c.parentId);
        if (parent) {
          for (const sep of ['→', '>', '-', '/']) {
            catByName.set(norm(`${parent.nameEn} ${sep} ${c.nameEn}`), c.id);
          }
        }
      }
      // Plain name only if unique across the whole tree (avoids e.g. "Others").
      if ((nameCount.get(plain) ?? 0) === 1) catByName.set(plain, c.id);
    }

    let created = 0;
    const failed: Array<{ row: number; title: string; error: string }> = [];

    // Parse one raw row into the common fields (throws on invalid values).
    const parseRow = (r: Record<string, unknown>) => {
      const title = String(r['title'] ?? '').trim();
      if (!title) throw new Error('Title is required');
      const catId = catByName.get(norm(String(r['category'] ?? '')));
      if (!catId) throw new Error(`Unknown or ambiguous category "${r['category']}" — pick from the dropdown (use "Parent → Child" for subcategories)`);
      const price = Number(r['price']);
      if (!price || price <= 0) throw new Error('Price must be greater than 0');
      const stock = Number(r['stock']);
      if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number ≥ 0');
      const mrpRaw = String(r['mrp'] ?? '').trim();
      const discRaw = String(r['discount'] ?? '').trim();
      const mrp = mrpRaw !== '' && Number(mrpRaw) > 0 ? Number(mrpRaw) : null;
      let discount = discRaw !== '' ? Math.round(Number(discRaw)) : 0;
      if (!Number.isFinite(discount) || discount < 0) discount = 0;
      if (discount > 100) discount = 100;
      const unit = VALID_UNITS.includes(String(r['unit'] ?? '').trim().toLowerCase())
        ? String(r['unit']).trim().toLowerCase() : 'piece';
      const condition = CONDITION_MAP[String(r['condition'] ?? '').trim().toLowerCase()] ?? 'brand_new';
      const desc = String(r['description'] ?? '').trim() || title;
      const brand = String(r['brand'] ?? '').trim() || '—';
      const sku = String(r['sku'] ?? '').trim();
      const option1 = String(r['option1'] ?? '').trim();
      const option2 = String(r['option2'] ?? '').trim();
      return { title, catId, price, stock, mrp, discount, unit, condition, desc, brand, sku, option1, option2 };
    };

    // Split rows into groups. Rows with a non-empty `group` merge into one
    // variant product; ungrouped rows are standalone. `order` preserves the
    // original row position for error messages.
    type RawRow = { r: Record<string, unknown>; rowNum: number };
    const groups = new Map<string, RawRow[]>();
    const singles: RawRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const rowNum = i + 2;
      const groupKey = String(r['group'] ?? '').trim();
      if (groupKey) {
        if (!groups.has(groupKey)) groups.set(groupKey, []);
        groups.get(groupKey)!.push({ r, rowNum });
      } else {
        singles.push({ r, rowNum });
      }
    }

    // 1) Standalone products.
    for (const { r, rowNum } of singles) {
      const title = String(r['title'] ?? '').trim();
      try {
        const p = parseRow(r);
        await db.insert(products).values({
          nameEn: p.title, nameNe: p.title, descriptionEn: p.desc, descriptionNe: p.desc,
          categoryId: p.catId, sellerId, brand: p.brand,
          sku: p.sku || generateSku(p.title),
          price: String(p.price), mrp: p.mrp != null ? String(p.mrp) : null, discountPercent: p.discount,
          unit: p.unit as 'piece' | 'meter' | 'pack' | 'set' | 'roll' | 'box',
          stockQuantity: p.stock, lowStockThreshold: 5,
          specifications: [], variants: [],
          condition: p.condition as 'brand_new' | 'like_new' | 'used', status: 'active',
        });
        created++;
      } catch (rowErr: any) {
        failed.push({ row: rowNum, title: title || '(no title)', error: rowErr?.message ?? 'Invalid row' });
      }
    }

    // 2) Grouped variant products — one product per group key.
    for (const [groupKey, groupRows] of groups) {
      const firstTitle = String(groupRows[0]!.r['title'] ?? '').trim() || groupKey;
      try {
        const parsed = groupRows.map(({ r }) => parseRow(r));
        const head = parsed[0]!;
        // Build variants from each row (option1 = size axis, option2 = colour).
        const variants = parsed.map((p) => ({
          size: p.option1, color: p.option2, label: [p.option1, p.option2].filter(Boolean).join(' / '),
          stock: p.stock, price: p.price, ...(p.mrp != null ? { mrp: p.mrp } : {}),
        }));
        const totalStock = variants.reduce((s, v) => s + v.stock, 0);
        const cheapest = parsed.reduce((min, p) => (p.price < min.price ? p : min), head);
        await db.insert(products).values({
          nameEn: head.title, nameNe: head.title, descriptionEn: head.desc, descriptionNe: head.desc,
          categoryId: head.catId, sellerId, brand: head.brand,
          sku: head.sku || generateSku(`${head.title}-${groupKey}`),
          price: String(cheapest.price),
          mrp: cheapest.mrp != null ? String(cheapest.mrp) : null,
          discountPercent: cheapest.discount,
          unit: head.unit as 'piece' | 'meter' | 'pack' | 'set' | 'roll' | 'box',
          stockQuantity: totalStock, lowStockThreshold: 5,
          specifications: [], variants,
          condition: head.condition as 'brand_new' | 'like_new' | 'used', status: 'active',
        });
        created++;
      } catch (rowErr: any) {
        failed.push({ row: groupRows[0]!.rowNum, title: `${firstTitle} (group "${groupKey}")`, error: rowErr?.message ?? 'Invalid group' });
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
