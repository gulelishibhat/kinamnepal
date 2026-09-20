import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────
export const orderStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'dispatched',
  'delivered',
  'cancelled',
  'payment_expired',
]);

export const paymentStatusSchema = z.enum(['pending', 'confirmed', 'failed', 'expired']);
export const paymentMethodSchema = z.enum(['qr', 'esewa', 'khalti', 'cash']);

// ─── Delivery address ────────────────────────────────────────────────────────
export const deliveryAddressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  district: z.string().min(1, 'District is required'),
});

// ─── Cart ─────────────────────────────────────────────────────────────────────
export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
});

// How the buyer chooses to pay: online (QR/eSewa/Khalti/Fonepay/bank) or
// cash on delivery. Online is the promoted default.
export const paymentTypeSchema = z.enum(['online', 'cod']);

// ─── Checkout ────────────────────────────────────────────────────────────────
export const checkoutSchema = z.object({
  // Customer info (required for guests)
  guestName: z.string().min(2, 'Name is required').max(100).optional(),
  guestPhone: z
    .string()
    .regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number')
    .optional(),
  guestEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  // Delivery
  deliveryAddress: deliveryAddressSchema,
  // Payment choice — online (default) or cash on delivery
  paymentType: paymentTypeSchema.optional().default('online'),
  // Optional note
  notes: z.string().max(500).optional(),
});

export const guestCheckoutSchema = checkoutSchema.extend({
  guestName: z.string().min(2, 'Name is required').max(100),
  guestPhone: z
    .string()
    .regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number'),
});

// ─── Order item (in response) ────────────────────────────────────────────────
export const orderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  lineTotal: z.number().positive(),
  productImage: z.string().url().optional(),
});

// ─── Payment record ──────────────────────────────────────────────────────────
export const paymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: paymentMethodSchema,
  status: paymentStatusSchema,
  transactionRef: z.string().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

// ─── Order status history entry ───────────────────────────────────────────────
export const orderStatusHistorySchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  changedBy: z.string().nullable(),
  changedAt: z.string().datetime(),
  note: z.string().nullable(),
});

// ─── Full order ───────────────────────────────────────────────────────────────
export const orderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string().nullable(),
  guestName: z.string().nullable(),
  guestPhone: z.string().nullable(),
  guestEmail: z.string().nullable(),
  deliveryAddress: deliveryAddressSchema,
  status: orderStatusSchema,
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  notes: z.string().nullable(),
  placedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(orderItemSchema).optional(),
  payment: paymentSchema.optional().nullable(),
  statusHistory: z.array(orderStatusHistorySchema).optional(),
});

// ─── Admin update order status ────────────────────────────────────────────────
export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  note: z.string().max(500).optional(),
});

// ─── Confirm payment (admin) ──────────────────────────────────────────────────
export const confirmPaymentSchema = z.object({
  transactionRef: z.string().optional(),
});

// ─── Guest order tracking ─────────────────────────────────────────────────────
export const trackOrderSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  phone: z
    .string()
    .regex(/^(98|97)\d{8}$/, 'Enter a valid Nepali mobile number'),
});

// ─── Order list query ─────────────────────────────────────────────────────────
export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
  status: orderStatusSchema.optional(),
  search: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  includeDeleted: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

// ─── SSE event payload ────────────────────────────────────────────────────────
export const orderSseEventSchema = z.object({
  type: z.literal('new_order'),
  data: z.object({
    orderId: z.string().uuid(),
    orderNumber: z.string(),
    customerName: z.string(),
    total: z.number(),
    placedAt: z.string().datetime(),
    status: orderStatusSchema,
  }),
});

// ─── Inferred types ───────────────────────────────────────────────────────────
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentType = z.infer<typeof paymentTypeSchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>;
export type Order = z.infer<typeof orderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type TrackOrderInput = z.infer<typeof trackOrderSchema>;
export type OrderQuery = z.infer<typeof orderQuerySchema>;
export type OrderSseEvent = z.infer<typeof orderSseEventSchema>;
