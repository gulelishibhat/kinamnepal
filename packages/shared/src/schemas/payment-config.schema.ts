import { z } from 'zod';

// How the customer completes a given method:
//   qr       — scan a QR code from a wallet/bank app
//   redirect — get sent to the provider's hosted checkout (eSewa/Khalti), then back
//   manual   — pay out-of-band (bank transfer) and the store confirms manually
export const paymentModeSchema = z.enum(['qr', 'redirect', 'manual']);

// A single payment method the customer can choose at checkout.
export const paymentMethodConfigSchema = z.object({
  id: z.enum(['esewa', 'khalti', 'bank', 'fonepay', 'nepalpay']),
  label: z.string(),
  mode: paymentModeSchema,
  // Human-readable account details shown as text on the payment screen.
  details: z.array(z.object({ key: z.string(), value: z.string() })),
  // The string encoded into the QR code (only meaningful for mode 'qr').
  // May contain an {AMOUNT} placeholder the client fills with the order total.
  qrValue: z.string().optional(),
  // For mode 'redirect': the API path the client POSTs to in order to start the
  // provider checkout and receive a redirect URL. e.g. '/payment/initiate/esewa'.
  initiatePath: z.string().optional(),
  // Optional instruction/help text.
  note: z.string().optional(),
});

export const paymentConfigSchema = z.object({
  storeName: z.string(),
  currency: z.string(),
  methods: z.array(paymentMethodConfigSchema),
});

export type PaymentMode = z.infer<typeof paymentModeSchema>;
export type PaymentMethodConfig = z.infer<typeof paymentMethodConfigSchema>;
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;
