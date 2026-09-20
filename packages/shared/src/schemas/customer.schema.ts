import { z } from 'zod';
import { deliveryAddressSchema } from './order.schema.js';

// ─── Customer profile ─────────────────────────────────────────────────────────
export const customerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: z.literal('customer'),
  language: z.enum(['en', 'ne']).default('en'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ─── Saved address ─────────────────────────────────────────────────────────────
export const savedAddressSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  label: z.string().max(50).optional(),
  address: deliveryAddressSchema,
  isDefault: z.boolean().default(false),
});

export const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  address: deliveryAddressSchema,
  isDefault: z.boolean().optional().default(false),
});

// ─── Update customer profile ───────────────────────────────────────────────────
export const updateCustomerProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number')
    .optional(),
  language: z.enum(['en', 'ne']).optional(),
});

// ─── Admin customer list query ─────────────────────────────────────────────────
export const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
  search: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

// ─── Admin customer summary (list view) ───────────────────────────────────────
export const customerSummarySchema = customerSchema.extend({
  totalOrders: z.number().int().nonnegative(),
  lastOrderDate: z.string().datetime().nullable(),
});

// ─── Inferred types ────────────────────────────────────────────────────────────
export type Customer = z.infer<typeof customerSchema>;
export type SavedAddress = z.infer<typeof savedAddressSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type CustomerSummary = z.infer<typeof customerSummarySchema>;
