import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────────────────────────
export const productStatusSchema = z.enum(['active', 'inactive', 'out_of_stock']);
export const productUnitSchema = z.enum(['piece', 'meter', 'pack', 'set', 'roll', 'box']);
export const productConditionSchema = z.enum(['brand_new', 'like_new', 'used']);

// ─── Bilingual text ─────────────────────────────────────────────────────────
export const bilingualTextSchema = z.object({
  en: z.string().min(1, 'English text is required'),
  ne: z.string().min(1, 'Nepali text is required'),
});

// ─── Specification entry ────────────────────────────────────────────────────
export const specificationSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

// ─── Product variant (selectable option with its own stock + price) ──────────
// Variants describe availability + stock per option. Two free-text axes are
// available: `size` and `color` (repurposed per product, e.g. size = spec /
// wattage / switch type, color = finish / bulb colour).
//  • `price`  — optional per-variant selling price. When set, selecting the
//               variant overrides the product's base price (B2 pricing).
//  • `mrp`    — optional per-variant original price for a strike-through.
//  • `label`  — optional display label for the option (e.g. the full spec).
// Total product stock is the sum of variant stock when variants are present.
export const productVariantSchema = z.object({
  size: z.string().max(80).optional().default(''),
  color: z.string().max(80).optional().default(''),
  label: z.string().max(160).optional().default(''),
  stock: z.number().int().nonnegative().default(0),
  price: z.number().positive().optional(),
  mrp: z.number().positive().optional(),
});

// ─── Category schemas ───────────────────────────────────────────────────────
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: bilingualTextSchema,
  slug: z.string(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const createCategorySchema = z.object({
  name: bilingualTextSchema,
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

// ─── Product schemas ─────────────────────────────────────────────────────────
export const productSchema = z.object({
  id: z.string().uuid(),
  name: bilingualTextSchema,
  description: bilingualTextSchema,
  categoryId: z.string().uuid(),
  brand: z.string().min(1),
  sku: z.string(),
  price: z.number().positive(),
  // Original (pre-discount) price. Null when there's no discount.
  mrp: z.number().positive().nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  unit: productUnitSchema,
  stockQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  images: z.array(z.string().url()).min(1, 'At least one image is required').max(10),
  specifications: z.array(specificationSchema),
  variants: z.array(productVariantSchema).optional().default([]),
  condition: productConditionSchema.default('brand_new'),
  status: productStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Joined
  categoryName: bilingualTextSchema.optional(),
  sellerId: z.string().uuid().nullable().optional(),
  // Public seller info (shop name only — private fields never included)
  seller: z
    .object({ id: z.string().uuid(), shopName: z.string() })
    .nullable()
    .optional(),
});

export const createProductSchema = z.object({
  name: bilingualTextSchema,
  description: bilingualTextSchema,
  categoryId: z.string().uuid('Invalid category'),
  brand: z.string().min(1, 'Brand is required').max(100),
  // SKU is optional — the API auto-generates one if left blank.
  sku: z.string().max(50).optional().default(''),
  price: z.number().positive('Price must be greater than 0'),
  // Optional discount: mrp = original price, discountPercent = % off (0–100).
  mrp: z.number().positive().nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).optional().default(0),
  unit: productUnitSchema,
  stockQuantity: z.number().int().nonnegative('Stock cannot be negative'),
  lowStockThreshold: z.number().int().nonnegative().optional().default(5),
  specifications: z.array(specificationSchema).optional().default([]),
  variants: z.array(productVariantSchema).optional().default([]),
  condition: productConditionSchema.optional().default('brand_new'),
  status: productStatusSchema.optional().default('active'),
});

export const updateProductSchema = createProductSchema.partial();

// ─── Bulk upload (CSV) ───────────────────────────────────────────────────────
// One row of the seller's CSV. `category` is the category NAME (matched
// server-side to its id). Coerced from strings since CSV values are text.
export const bulkProductRowSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().default(''),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional().default(''),
  sku: z.string().max(50).optional().default(''),
  price: z.coerce.number().positive('Price must be greater than 0'),
  unit: z.string().optional().default('piece'),
  stock: z.coerce.number().int().nonnegative('Stock cannot be negative'),
  condition: z.string().optional().default('brand_new'),
});

// Lenient wrapper — rows are validated per-row in the handler so that good rows
// still import while bad rows are reported individually (not all-or-nothing).
export const bulkProductUploadSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'No rows').max(500, 'Too many rows (max 500)'),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(24),
  categoryId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  condition: productConditionSchema.optional(),
  brand: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  status: productStatusSchema.optional(),
  inStock: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'best_match']).optional().default('newest'),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductUnit = z.infer<typeof productUnitSchema>;
export type ProductCondition = z.infer<typeof productConditionSchema>;
export type BilingualText = z.infer<typeof bilingualTextSchema>;
export type Specification = z.infer<typeof specificationSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Product = z.infer<typeof productSchema>;
// Use z.input so fields with defaults (condition, status, etc.) are optional
// in the payload type that frontends construct.
export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type BulkProductRow = z.input<typeof bulkProductRowSchema>;
export type BulkProductUploadInput = z.input<typeof bulkProductUploadSchema>;
