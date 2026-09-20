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

// ─── Product variant (size / colour with its own stock) ─────────────────────
// Lightweight: variants describe availability + stock per size/colour combo.
// Total product stock is the sum of variant stock when variants are present.
export const productVariantSchema = z.object({
  size: z.string().max(40).optional().default(''),
  color: z.string().max(40).optional().default(''),
  stock: z.number().int().nonnegative().default(0),
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
  unit: productUnitSchema,
  stockQuantity: z.number().int().nonnegative('Stock cannot be negative'),
  lowStockThreshold: z.number().int().nonnegative().optional().default(5),
  specifications: z.array(specificationSchema).optional().default([]),
  variants: z.array(productVariantSchema).optional().default([]),
  condition: productConditionSchema.optional().default('brand_new'),
  status: productStatusSchema.optional().default('active'),
});

export const updateProductSchema = createProductSchema.partial();

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
