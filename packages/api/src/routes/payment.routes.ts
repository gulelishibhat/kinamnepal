import { Router } from 'express';
import { env } from '../config/env.js';
import { buildNepalPayQr } from '../lib/nepalpay-qr.js';
import { esewaSignature, ESEWA_SANDBOX_SECRET, markOrderPaid } from '../lib/payment-gateway.js';
import type { PaymentConfig } from '@mkelectric/shared';

const router = Router();

/**
 * GET /payment/config
 * Public — returns the store's payment options for the checkout screen.
 * Each method has a `mode`:
 *   qr       → client renders a QR (qrValue, {AMOUNT} replaced client-side)
 *   redirect → client POSTs to `initiatePath` to get a provider checkout URL
 *   manual   → pay out-of-band; store confirms receipt manually
 */
router.get('/config', (_req, res) => {
  const store = env.STORE_NAME;

  // NepalPay QR carries an {AMOUNT} placeholder the client fills at pay time.
  // We build it once with amount 0 then swap; simpler: build with placeholder.
  const nepalPayTemplate = buildNepalPayQr({
    merchantId: env.PAY_NEPALPAY_MERCHANT_ID,
    merchantName: store,
    merchantCity: env.PAY_MERCHANT_CITY,
    // amount omitted → dynamic QR (payer enters/confirms amount in their app).
  });

  const config: PaymentConfig = {
    storeName: store,
    currency: env.STORE_CURRENCY,
    methods: [
      {
        id: 'nepalpay',
        label: 'Scan QR (NepalPay / Fonepay)',
        mode: 'qr',
        details: [
          { key: 'Merchant', value: store },
          { key: 'Merchant ID', value: env.PAY_NEPALPAY_MERCHANT_ID },
        ],
        qrValue: nepalPayTemplate,
        note: 'Scan with eSewa, Khalti, IME Pay or any mobile-banking app.',
      },
      {
        id: 'esewa',
        label: 'eSewa',
        mode: 'redirect',
        details: [{ key: 'Pay via', value: 'eSewa hosted checkout' }],
        initiatePath: '/payment/initiate/esewa',
        note: "You'll be redirected to eSewa to complete payment.",
      },
      {
        id: 'khalti',
        label: 'Khalti',
        mode: 'redirect',
        details: [{ key: 'Pay via', value: 'Khalti hosted checkout' }],
        initiatePath: '/payment/initiate/khalti',
        note: "You'll be redirected to Khalti to complete payment.",
      },
      {
        id: 'bank',
        label: 'Bank Transfer',
        mode: 'manual',
        details: [
          { key: 'Bank', value: env.PAY_BANK_NAME },
          { key: 'Account Name', value: env.PAY_BANK_ACCOUNT_NAME },
          { key: 'Account Number', value: env.PAY_BANK_ACCOUNT_NUMBER },
          { key: 'Branch', value: env.PAY_BANK_BRANCH },
        ],
        note: 'Transfer to the account above, then keep the receipt. Your order is confirmed once we verify the payment.',
      },
    ],
  };

  res.json({ success: true, data: config });
});

/**
 * POST /payment/initiate/:method
 * Body: { orderId, orderNumber, amount }
 * Returns { redirectUrl } to the provider's hosted checkout (sandbox in dev).
 * NOTE: sample/developer integration — the provider's success callback that
 * auto-confirms the order is not wired yet; the admin confirms receipt for now.
 */
router.post('/initiate/:method', (req, res) => {
  const method = req.params['method'];
  const { orderId, orderNumber, amount } = req.body as {
    orderId?: string;
    orderNumber?: string;
    amount?: number;
  };

  if (!orderId || !orderNumber || !amount || amount <= 0) {
    res.status(400).json({ success: false, error: 'orderId, orderNumber and amount are required' });
    return;
  }

  // The provider returns to OUR API callback (server-side verify), which then
  // marks the order paid and redirects the customer to the order-success page.
  const apiBase = `${req.protocol}://${req.get('host')}`;
  const successUrl = `${apiBase}/api/payment/callback/${method}`;
  const failureUrl = `${env.PAYMENT_RETURN_URL.replace(/\/$/, '')}/order-success/${orderId}?orderNumber=${encodeURIComponent(orderNumber)}&paid=failed`;

  if (method === 'esewa') {
    // eSewa ePay v2 hosted form (sandbox). Requires an HMAC-SHA256 signature
    // over total_amount,transaction_uuid,product_code.
    const host =
      env.ESEWA_ENV === 'production'
        ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
        : 'https://rc-epay.esewa.com.np/api/epay/main/v2/form';
    const totalAmount = String(amount);
    const productCode = env.ESEWA_MERCHANT_CODE;
    const secret = env.ESEWA_ENV === 'production' ? env.ESEWA_SECRET_KEY : ESEWA_SANDBOX_SECRET;
    const signature = esewaSignature(totalAmount, orderNumber, productCode, secret);
    const params = new URLSearchParams({
      amount: totalAmount,
      tax_amount: '0',
      total_amount: totalAmount,
      transaction_uuid: orderNumber,
      product_code: productCode,
      product_service_charge: '0',
      product_delivery_charge: '0',
      success_url: successUrl,
      failure_url: failureUrl,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature,
    });
    res.json({
      success: true,
      data: { redirectUrl: `${host}?${params.toString()}`, provider: 'esewa' },
    });
    return;
  }

  if (method === 'khalti') {
    // Khalti sandbox. A full integration POSTs server-side with the secret key
    // to obtain a pidx + payment_url. With a sample key we route to the sandbox
    // portal, returning to our callback. Swap for the real initiate once you
    // have a live Khalti secret key.
    const portal =
      env.KHALTI_ENV === 'production' ? 'https://pay.khalti.com' : 'https://test-pay.khalti.com';
    const returnUrl = `${successUrl}?purchase_order_id=${encodeURIComponent(orderNumber)}`;
    res.json({
      success: true,
      data: {
        redirectUrl: `${portal}/?amount=${amount * 100}&purchase_order_id=${encodeURIComponent(orderNumber)}&return_url=${encodeURIComponent(returnUrl)}`,
        provider: 'khalti',
      },
    });
    return;
  }

  res.status(400).json({ success: false, error: `Unsupported payment method: ${method}` });
});

/**
 * GET /payment/callback/:method
 * The provider redirects the customer back here after paying. We verify the
 * result, mark the order confirmed, then redirect to the order-success page.
 * NOTE: sandbox/sample verification is lenient (dev demo). With real credentials
 * this should call the provider's status API to confirm the transaction.
 */
router.get('/callback/:method', async (req, res, next) => {
  try {
    const method = req.params['method'];
    const site = env.PAYMENT_RETURN_URL.replace(/\/$/, '');
    let orderNumber = '';
    let txnRef: string | null = null;

    if (method === 'esewa') {
      // eSewa v2 returns base64 JSON in ?data= with transaction_uuid + status.
      const dataParam = String(req.query['data'] ?? '');
      if (dataParam) {
        try {
          const decoded = JSON.parse(Buffer.from(dataParam, 'base64').toString('utf8'));
          orderNumber = decoded.transaction_uuid ?? '';
          txnRef = decoded.transaction_code ?? decoded.ref_id ?? null;
          if (decoded.status && decoded.status !== 'COMPLETE') {
            res.redirect(`${site}/order-success/x?orderNumber=${encodeURIComponent(orderNumber)}&paid=failed`);
            return;
          }
        } catch { /* fall through to failure */ }
      }
    } else if (method === 'khalti') {
      orderNumber = String(req.query['purchase_order_id'] ?? '');
      txnRef = String(req.query['transaction_id'] ?? req.query['pidx'] ?? '') || null;
      const status = String(req.query['status'] ?? 'Completed');
      if (status && status.toLowerCase() !== 'completed') {
        res.redirect(`${site}/order-success/x?orderNumber=${encodeURIComponent(orderNumber)}&paid=failed`);
        return;
      }
    }

    if (!orderNumber) {
      res.redirect(`${site}/order-success/x?paid=failed`);
      return;
    }

    const result = await markOrderPaid(orderNumber, txnRef);
    const paid = result.ok ? 'success' : 'failed';
    const oid = result.orderId ?? 'x';
    res.redirect(`${site}/order-success/${oid}?orderNumber=${encodeURIComponent(orderNumber)}&paid=${paid}`);
  } catch (err) {
    next(err);
  }
});

export default router;
