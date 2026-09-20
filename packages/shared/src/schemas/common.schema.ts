import { z } from 'zod';

// ─── Paginated response wrapper ───────────────────────────────────────────────
export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

// ─── API success response ─────────────────────────────────────────────────────
export function successResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });
}

// ─── API error response ───────────────────────────────────────────────────────
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
  code: z.string().optional(),
});

// ─── UUID param ───────────────────────────────────────────────────────────────
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// ─── Locale ───────────────────────────────────────────────────────────────────
export const localeSchema = z.enum(['en', 'ne']);

// ─── Inferred types ───────────────────────────────────────────────────────────
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Locale = z.infer<typeof localeSchema>;
