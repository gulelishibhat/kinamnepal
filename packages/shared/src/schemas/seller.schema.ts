import { z } from 'zod';
import { passwordSchema } from './auth.schema.js';

// ─── Seller registration (self-service) ─────────────────────────────────────
export const registerSellerSchema = z.object({
  // Login
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  // Public shop profile
  shopName: z.string().min(2, 'Shop name is required').max(120),
  shopDescription: z.string().max(1000).optional(),
  // Private profile
  ownerName: z.string().min(2, 'Owner name is required').max(100),
  phone: z.string().regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number'),
  addressStreet: z.string().max(255).optional(),
  addressCity: z.string().max(100).optional(),
  addressDistrict: z.string().max(100).optional(),
});

export const sellerLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Update own seller profile ───────────────────────────────────────────────
export const updateSellerProfileSchema = z.object({
  shopName: z.string().min(2).max(120).optional(),
  shopDescription: z.string().max(1000).optional(),
  ownerName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number').optional(),
  addressStreet: z.string().max(255).optional(),
  addressCity: z.string().max(100).optional(),
  addressDistrict: z.string().max(100).optional(),
});

// ─── Public seller profile (what the storefront may show) ────────────────────
// PRIVATE fields (ownerName, phone, address) are intentionally excluded.
export const publicSellerSchema = z.object({
  id: z.string().uuid(),
  shopName: z.string(),
  shopDescription: z.string().nullable(),
  createdAt: z.string().datetime(),
});

// ─── Full seller profile (only the seller themselves + admin) ────────────────
export const sellerProfileSchema = publicSellerSchema.extend({
  email: z.string().email(),
  ownerName: z.string(),
  phone: z.string(),
  addressStreet: z.string().nullable(),
  addressCity: z.string().nullable(),
  addressDistrict: z.string().nullable(),
  isApproved: z.boolean(),
  isActive: z.boolean(),
});

// ─── Inferred types ──────────────────────────────────────────────────────────
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;
export type SellerLoginInput = z.infer<typeof sellerLoginSchema>;
export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;
export type PublicSeller = z.infer<typeof publicSellerSchema>;
export type SellerProfile = z.infer<typeof sellerProfileSchema>;
