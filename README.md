# MK Electric Shop

Full-stack e-commerce platform for a large-scale electrical goods retail store in Nepal.
Mobile-first storefront, real-time admin dashboard, QR-based payments, English + Nepali (i18n).

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **State:** Zustand (cart/auth) + TanStack Query (server state)
- **i18n:** react-i18next (English + Nepali)
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** JWT (HttpOnly cookies) + bcrypt
- **Real-time:** Server-Sent Events (SSE)
- **Storage:** MinIO local / S3 in prod (also archives completed orders as JSON)
- **Monorepo:** pnpm workspaces

> Note: this build has no email service. Customers check out with name + phone,
> and the admin contacts them by phone. Completed (paid) orders are archived as
> JSON to storage.

## Project Structure

```
mkelectricshop/
├── apps/
│   ├── web/          Customer storefront (port 5173)
│   └── admin/        Admin dashboard (port 5174)
├── packages/
│   ├── api/          Express REST API + SSE (port 4000)
│   └── shared/       Zod schemas, types, i18n locales
├── docker-compose.yml
└── .env              (copy from .env.example)
```

## Prerequisites

- Node.js 20+ (you have v22)
- pnpm 9+ (`npm install -g pnpm@9`)
- Docker Desktop (must be running)

## Getting Started

```powershell
# 1. Install dependencies (already done)
pnpm install

# 2. Start infrastructure (PostgreSQL, MinIO)
pnpm docker:up

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed the first admin + sample categories
pnpm db:seed

# 5. Start everything in dev mode
pnpm dev
```

Then open:
- Storefront: http://localhost:5173
- Admin panel: http://localhost:5174
- MinIO console: http://localhost:9001 (minioadmin / minioadmin123)

## Default Admin Login

Set in `.env` (change after first login):
- Email: `admin@mkelectric.com`
- Password: `Admin@12345`

## Individual Dev Commands

```powershell
pnpm dev:api      # API only
pnpm dev:web      # Storefront only
pnpm dev:admin    # Admin only
```

## Useful Commands

```powershell
pnpm build            # Build all packages
pnpm type-check       # Type-check all packages
pnpm db:generate      # Regenerate migration after schema changes
pnpm db:studio        # Drizzle Studio (DB browser)
pnpm docker:down      # Stop infrastructure
```

## Deployment (AWS, no Docker)

Frontends → S3 + CloudFront · API → Elastic Beanstalk (Node.js 22) · DB → RDS ·
Media + order archives → S3. Full step-by-step guide: **`docs/DEPLOYMENT.md`**.

## Before Production

- [ ] Replace `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with strong random values
- [ ] Set the real store QR payment ID (`STORE_QR_UPI_ID`)
- [ ] Point storage at the production S3 bucket + CloudFront (`STORAGE_DRIVER=s3`)
- [ ] Set `CORS_ORIGINS` and cookie `COOKIE_SAMESITE`/`COOKIE_SECURE` for your domains
- [ ] Change the seeded admin password

## MVP Status

**Implemented (P0/P1):** product catalog, cart, guest + registered checkout, QR payment flow,
order placement, admin JWT auth, real-time SSE order dashboard, order management, inventory CRUD,
customer management, English + Nepali i18n.

**Not yet implemented (P2+):** advanced analytics/reports, CSV bulk import/export, SMS/push
notifications, payment gateway API integration.
