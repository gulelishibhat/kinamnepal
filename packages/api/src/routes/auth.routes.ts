import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { db } from '../db/index.js';
import { env } from '../config/env.js';
import { customers, admins, sellers, refreshTokens } from '../db/schema.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendSignupAdminAlert } from '../lib/mailer.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  loginSchema,
  registerCustomerSchema,
  adminLoginSchema,
  registerSellerSchema,
  sellerLoginSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
} from '@mkelectric/shared';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // failed attempts before lockout (successful logins don't count)
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed logins toward the limit
});

const COOKIE_OPTS = {
  httpOnly: true,
  // SameSite=None requires Secure=true. Configurable for cross-origin AWS setups.
  secure: env.COOKIE_SECURE || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
};

function setTokenCookies(res: import('express').Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    ...COOKIE_OPTS,
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  res.cookie('refresh_token', refreshToken, {
    ...COOKIE_OPTS,
    maxAge: 16 * 60 * 60 * 1000, // 16 hours
  });
}

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', validate(registerCustomerSchema), async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body as import('@mkelectric/shared').RegisterCustomerInput;

    const existing = await db.query.customers.findFirst({ where: eq(customers.email, email) });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = randomBytes(32).toString('hex');
    const [customer] = await db.insert(customers).values({
      name, email, passwordHash, phone,
      verificationToken, verificationSentAt: new Date(),
    }).returning();

    if (!customer) throw new Error('Failed to create customer');

    // Fire-and-forget verification email (allow-but-nag: login still works).
    const verifyUrl = `${env.API_HOST}/api/auth/verify-email?token=${verificationToken}&role=customer`;
    sendVerificationEmail(email, name, verifyUrl).catch((e) => console.error('[verify email]', e));

    const accessToken = signAccessToken(customer.id, 'customer');
    const refreshToken = signRefreshToken(customer.id, 'customer');

    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: customer.id,
      userRole: 'customer',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });

    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      data: { user: { id: customer.id, name: customer.name, email: customer.email, role: 'customer', emailVerified: false }, accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as import('@mkelectric/shared').LoginInput;

    const customer = await db.query.customers.findFirst({ where: eq(customers.email, email) });
    if (!customer || !(await bcrypt.compare(password, customer.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const accessToken = signAccessToken(customer.id, 'customer');
    const refreshToken = signRefreshToken(customer.id, 'customer');

    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: customer.id,
      userRole: 'customer',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });

    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: { user: { id: customer.id, name: customer.name, email: customer.email, role: 'customer' }, accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/admin/login ───────────────────────────────────────────────────
router.post('/admin/login', loginLimiter, validate(adminLoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as import('@mkelectric/shared').AdminLoginInput;

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin || !admin.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const accessToken = signAccessToken(admin.id, 'admin');
    const refreshToken = signRefreshToken(admin.id, 'admin');

    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: admin.id,
      userRole: 'admin',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });

    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: { user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' }, accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/seller/register ────────────────────────────────────────────────
router.post('/seller/register', validate(registerSellerSchema), async (req, res, next) => {
  try {
    const body = req.body as import('@mkelectric/shared').RegisterSellerInput;

    const existing = await db.query.sellers.findFirst({ where: eq(sellers.email, body.email) });
    if (existing) {
      res.status(409).json({ success: false, error: 'A seller account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const verificationToken = randomBytes(32).toString('hex');
    const [seller] = await db.insert(sellers).values({
      email: body.email,
      passwordHash,
      shopName: body.shopName,
      shopDescription: body.shopDescription ?? null,
      ownerName: body.ownerName,
      phone: body.phone,
      addressStreet: body.addressStreet ?? null,
      addressCity: body.addressCity ?? null,
      addressDistrict: body.addressDistrict ?? null,
      verificationToken,
      verificationSentAt: new Date(),
    }).returning();

    if (!seller) throw new Error('Failed to create seller');

    const verifyUrl = `${env.API_HOST}/api/auth/verify-email?token=${verificationToken}&role=seller`;
    sendVerificationEmail(body.email, body.shopName, verifyUrl).catch((e) => console.error('[verify email]', e));
    // Notify the internal alert inbox so the new email can be SES-verified.
    sendSignupAdminAlert({ role: 'seller', email: body.email, name: body.shopName, phone: body.phone })
      .catch((e) => console.error('[signup alert]', e));

    const accessToken = signAccessToken(seller.id, 'seller');
    const refreshToken = signRefreshToken(seller.id, 'seller');
    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: seller.id,
      userRole: 'seller',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      data: { user: { id: seller.id, name: seller.shopName, email: seller.email, role: 'seller' }, accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/seller/login ───────────────────────────────────────────────────
router.post('/seller/login', loginLimiter, validate(sellerLoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as import('@mkelectric/shared').SellerLoginInput;

    const seller = await db.query.sellers.findFirst({ where: eq(sellers.email, email) });
    if (!seller || !seller.isActive || !(await bcrypt.compare(password, seller.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const accessToken = signAccessToken(seller.id, 'seller');
    const refreshToken = signRefreshToken(seller.id, 'seller');
    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: seller.id,
      userRole: 'seller',
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: { user: { id: seller.id, name: seller.shopName, email: seller.email, role: 'seller' }, accessToken },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    if (!token) {
      res.status(401).json({ success: false, error: 'No refresh token' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const stored = await db.query.refreshTokens.findFirst({
      where: (t, { and, eq }) => and(eq(t.token, token), eq(t.revoked, false)),
    });

    if (!stored) {
      res.status(401).json({ success: false, error: 'Refresh token revoked or not found' });
      return;
    }

    // Revoke old, issue new
    await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.token, token));

    const newAccess = signAccessToken(payload.sub, payload.role);
    const newRefresh = signRefreshToken(payload.sub, payload.role);

    await db.insert(refreshTokens).values({
      token: newRefresh,
      userId: payload.sub,
      userRole: payload.role,
      expiresAt: new Date(Date.now() + 16 * 60 * 60 * 1000),
    });

    setTokenCookies(res, newAccess, newRefresh);
    res.json({ success: true, data: { accessToken: newAccess } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    if (token) {
      await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.token, token));
    }
    res.clearCookie('access_token', COOKIE_OPTS);
    res.clearCookie('refresh_token', COOKIE_OPTS);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/verify-email?token=...&role=customer|seller ─────────────────────
// Opened from the emailed link. Marks the account verified, then redirects to
// the appropriate frontend with a status flag.
router.get('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.query['token'] ?? '');
    const role = String(req.query['role'] ?? 'customer');
    const webBase = role === 'seller' ? env.VERIFY_REDIRECT_SELLER : env.VERIFY_REDIRECT_WEB;

    if (!token) { res.redirect(`${webBase}/?verified=invalid`); return; }

    if (role === 'seller') {
      const seller = await db.query.sellers.findFirst({ where: eq(sellers.verificationToken, token) });
      if (!seller) { res.redirect(`${webBase}/?verified=invalid`); return; }
      await db.update(sellers).set({ emailVerified: true, verificationToken: null }).where(eq(sellers.id, seller.id));
    } else {
      const customer = await db.query.customers.findFirst({ where: eq(customers.verificationToken, token) });
      if (!customer) { res.redirect(`${webBase}/?verified=invalid`); return; }
      await db.update(customers).set({ emailVerified: true, verificationToken: null }).where(eq(customers.id, customer.id));
    }
    res.redirect(`${webBase}/?verified=success`);
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/resend-verification (authenticated) ────────────────────────────
router.post('/resend-verification', authenticate, async (req, res, next) => {
  try {
    const { sub, role } = req.user!;
    const verificationToken = randomBytes(32).toString('hex');

    if (role === 'seller') {
      const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sub) });
      if (!seller) { res.status(404).json({ success: false, error: 'Not found' }); return; }
      if (seller.emailVerified) { res.json({ success: true, data: { alreadyVerified: true } }); return; }
      await db.update(sellers).set({ verificationToken, verificationSentAt: new Date() }).where(eq(sellers.id, sub));
      const url = `${env.API_HOST}/api/auth/verify-email?token=${verificationToken}&role=seller`;
      sendVerificationEmail(seller.email, seller.shopName, url).catch((e) => console.error('[verify email]', e));
    } else if (role === 'customer') {
      const customer = await db.query.customers.findFirst({ where: eq(customers.id, sub) });
      if (!customer) { res.status(404).json({ success: false, error: 'Not found' }); return; }
      if (customer.emailVerified) { res.json({ success: true, data: { alreadyVerified: true } }); return; }
      await db.update(customers).set({ verificationToken, verificationSentAt: new Date() }).where(eq(customers.id, sub));
      const url = `${env.API_HOST}/api/auth/verify-email?token=${verificationToken}&role=customer`;
      sendVerificationEmail(customer.email, customer.name, url).catch((e) => console.error('[verify email]', e));
    }
    res.json({ success: true, data: { sent: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/forgot-password ────────────────────────────────────────────────
// Emails a reset link. Always returns success (never reveals whether the email
// exists) to avoid account enumeration. Works for customers and sellers.
router.post('/forgot-password', loginLimiter, validate(resetPasswordRequestSchema), async (req, res, next) => {
  try {
    const { email, role } = req.body as import('@mkelectric/shared').ResetPasswordRequestInput;
    const resetToken = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const webBase = role === 'seller' ? env.VERIFY_REDIRECT_SELLER : env.VERIFY_REDIRECT_WEB;
    const resetUrl = `${webBase}/reset-password?token=${resetToken}&role=${role}`;

    if (role === 'seller') {
      const seller = await db.query.sellers.findFirst({ where: eq(sellers.email, email) });
      if (seller) {
        await db.update(sellers)
          .set({ resetToken, resetTokenExpires: expires })
          .where(eq(sellers.id, seller.id));
        sendPasswordResetEmail(seller.email, seller.shopName, resetUrl).catch((e) => console.error('[reset email]', e));
      }
    } else {
      const customer = await db.query.customers.findFirst({ where: eq(customers.email, email) });
      if (customer) {
        await db.update(customers)
          .set({ resetToken, resetTokenExpires: expires })
          .where(eq(customers.id, customer.id));
        sendPasswordResetEmail(customer.email, customer.name, resetUrl).catch((e) => console.error('[reset email]', e));
      }
    }
    // Always the same response regardless of whether the account exists.
    res.json({ success: true, data: { sent: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/reset-password ─────────────────────────────────────────────────
// Consumes the emailed token and sets a new password.
router.post('/reset-password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, role, newPassword } = req.body as import('@mkelectric/shared').ResetPasswordInput;
    const now = new Date();
    const passwordHash = await bcrypt.hash(newPassword, 12);

    if (role === 'seller') {
      const seller = await db.query.sellers.findFirst({ where: eq(sellers.resetToken, token) });
      if (!seller || !seller.resetTokenExpires || seller.resetTokenExpires < now) {
        res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
        return;
      }
      await db.update(sellers)
        .set({ passwordHash, resetToken: null, resetTokenExpires: null, updatedAt: now })
        .where(eq(sellers.id, seller.id));
    } else {
      const customer = await db.query.customers.findFirst({ where: eq(customers.resetToken, token) });
      if (!customer || !customer.resetTokenExpires || customer.resetTokenExpires < now) {
        res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
        return;
      }
      await db.update(customers)
        .set({ passwordHash, resetToken: null, resetTokenExpires: null, updatedAt: now })
        .where(eq(customers.id, customer.id));
    }
    res.json({ success: true, data: { reset: true } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { sub, role } = req.user!;
    if (role === 'admin') {
      const admin = await db.query.admins.findFirst({ where: eq(admins.id, sub) });
      if (!admin) { res.status(404).json({ success: false, error: 'Not found' }); return; }
      res.json({ success: true, data: { id: admin.id, name: admin.name, email: admin.email, role: 'admin', emailVerified: true } });
    } else if (role === 'seller') {
      const seller = await db.query.sellers.findFirst({ where: eq(sellers.id, sub) });
      if (!seller) { res.status(404).json({ success: false, error: 'Not found' }); return; }
      res.json({ success: true, data: { id: seller.id, name: seller.shopName, email: seller.email, role: 'seller', emailVerified: seller.emailVerified } });
    } else {
      const customer = await db.query.customers.findFirst({ where: eq(customers.id, sub) });
      if (!customer) { res.status(404).json({ success: false, error: 'Not found' }); return; }
      res.json({ success: true, data: { id: customer.id, name: customer.name, email: customer.email, role: 'customer', emailVerified: customer.emailVerified } });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
