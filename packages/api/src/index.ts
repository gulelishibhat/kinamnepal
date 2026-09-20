import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import customerRoutes from './routes/customer.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import sseRoutes from './routes/sse.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();

// Behind App Runner / ALB the app sits behind a proxy — trust it so secure
// cookies and rate-limit client IPs resolve correctly.
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow product images served from this origin (disk driver) to be embedded
    // by the storefront/admin origins.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Static uploads (disk storage driver / local dev only) ────────────────────
// In dev/production the S3 driver serves images from S3/CloudFront instead.
if (env.STORAGE_DRIVER === 'disk') {
  app.use(
    '/uploads',
    express.static(env.UPLOAD_DIR, {
      maxAge: '1y',
      immutable: true,
    }),
  );
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/sse', sseRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(env.API_PORT, () => {
  console.log(`🚀 MK Electric API running on port ${env.API_PORT} [${env.NODE_ENV}]`);
  console.log(`   Health: http://localhost:${env.API_PORT}/health`);
});

export default app;
