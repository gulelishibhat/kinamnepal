# MK Electric Shop — AWS Deployment Guide

# MK Electric Shop — AWS Deployment Guide

This guide deploys MK Electric Shop to AWS with **no Docker**:
- **Frontends** → S3 + CloudFront (static hosting)
- **API** → **Elastic Beanstalk** (Node.js 22) — always-on so real-time SSE works
- **Database** → RDS PostgreSQL
- **Media storage** → S3
- **Email** → not used (customers are contacted by phone; completed orders are
  archived as JSON to S3)

## Architecture

```
                          ┌──────────────────────────┐
   Customers ─────────────▶  CloudFront + S3          │  (storefront static site)
                          └──────────────────────────┘
                          ┌──────────────────────────┐
   Admins ────────────────▶  CloudFront + S3          │  (admin static site)
                          └──────────────────────────┘
                                     │  HTTPS (REST + SSE)
                          ┌──────────▼───────────────┐
                          │  Elastic Beanstalk        │  (Express API — always on)
                          │  Node.js 22, nginx proxy  │
                          └──────────┬───────────────┘
              ┌──────────────────────┼──────────────────────┐
     ┌────────▼────────┐   ┌─────────▼──────────────────────▼────┐
     │  RDS PostgreSQL │   │  S3 (product media + order archives) │
     │                 │   │  + CloudFront CDN for media          │
     └─────────────────┘   └──────────────────────────────────────┘
```

**Why Elastic Beanstalk and not Lambda:** the admin dashboard uses Server-Sent
Events (SSE) for real-time order notifications, which needs a long-lived
connection. Lambda + API Gateway cannot hold those open (29s cap). EB runs the
Express server on an always-on instance, so SSE works unchanged. (App Runner would
also work, but it closed to new AWS customers on 2026-04-30 — EB has no such limit.)

## Environments

| Env | APP_ENV | Storage | Email | Notes |
|---|---|---|---|---|
| local | `local` | disk | none | No AWS needed |
| dev | `dev` | S3 | none | Staging on AWS |
| production | `production` | S3 (+CloudFront) | none | Live |

---

## Prerequisites

- AWS account + AWS CLI configured (`aws configure`)
- EB CLI: `pip install awsebcli`
- A registered domain (optional but recommended for CORS + cookies)
- Region assumed below: `us-west-2` (change as needed)
- **No Docker required.**

---

## Step 1 — Database (RDS PostgreSQL)

1. Create an **RDS PostgreSQL 16** instance (or **Aurora Serverless v2** for auto-scaling).
   - DB name: `mkelectricshop`
   - Master user: `mkelectric`
   - Place it in **private subnets**; do not make it publicly accessible.
2. Note the endpoint; build the `DATABASE_URL`:
   ```
   postgresql://mkelectric:PASSWORD@ENDPOINT:5432/mkelectricshop
   ```
3. Security group: allow inbound `5432` **only** from the App Runner VPC connector
   (see Step 5) — not from the internet.

## Step 2 — Media storage (S3 + CloudFront)

1. Create S3 bucket `mkelectric-media-prod` (and `-dev`). Block public ACLs.
2. Create a **CloudFront distribution** with the bucket as origin (via Origin Access
   Control). Note the distribution domain — set it as `S3_PUBLIC_BASE_URL`
   (e.g. `https://media.mkelectric.example.com`).
3. The API writes objects with `Cache-Control: public, max-age=31536000, immutable`.

## Step 3 — Email (SES)

1. Verify your sender domain (or at least the `EMAIL_FROM` address) in **Amazon SES**.
2. Move out of the **SES sandbox** (request production access) before going live,
   otherwise you can only send to verified addresses.
3. No SMTP credentials needed — the API uses the SES API via the instance IAM role.

## Step 4 — Secrets (Secrets Manager)

Optionally store sensitive values in Secrets Manager (or just use `eb setenv` in Step 5c):

```bash
aws secretsmanager create-secret --name mkelectric/prod/database_url  --secret-string "postgresql://..."
aws secretsmanager create-secret --name mkelectric/prod/jwt_access    --secret-string "$(openssl rand -base64 48)"
aws secretsmanager create-secret --name mkelectric/prod/jwt_refresh   --secret-string "$(openssl rand -base64 48)"
aws secretsmanager create-secret --name mkelectric/prod/qr_upi_id     --secret-string "yourmerchant@bank"
```

## Step 5 — API on Elastic Beanstalk (no Docker)

EB deploys your source, runs the `.platform/hooks/prebuild/01_build.sh` hook to
install pnpm + compile TypeScript, then starts the API via the root `Procfile`
(`node packages/api/dist/index.js`). Config lives in `.ebextensions/01_options.config`
and `.ebignore`.

### 5a. IAM instance role

The EB EC2 instance profile needs S3 (media + order archives) and Secrets Manager
access. Attach the policy in `deploy/iam-instance-role-policy.json` to the instance
profile role (default `aws-elasticbeanstalk-ec2-role`), then remove the SES statement
(email isn't used).

### 5b. Initialise and create the environment

From the repo root:

```bash
eb init --platform "Node.js 22 running on 64bit Amazon Linux 2023" \
        --region us-west-2 mkelectric-api

eb create mkelectric-api-prod \
  --instance-types t3.small \
  --envvars APP_ENV=production,PORT=8080
```

The `.ebextensions` options (port 8080, nginx proxy, `/health` check, non-secret env
vars) apply automatically.

### 5c. Set secrets + runtime env

```bash
eb setenv \
  DATABASE_URL="postgresql://mkelectric:PASSWORD@ENDPOINT:5432/mkelectricshop" \
  JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  STORE_QR_UPI_ID="yourmerchant@bank" \
  CORS_ORIGINS="https://mkelectric.example.com,https://admin.mkelectric.example.com" \
  S3_PUBLIC_BASE_URL="https://media.mkelectric.example.com"
```

> For stronger secret handling, store `DATABASE_URL`/JWT values in Secrets Manager and
> reference them; the instance role already grants `secretsmanager:GetSecretValue` on
> `mkelectric/*`. The simpler `eb setenv` approach above is fine for an MVP.

### 5d. Networking (reach private RDS)

Put the EB environment in the **same VPC** as RDS, and allow the EB instance security
group inbound to RDS on `5432`. (EB console → Configuration → Instances → VPC, or set
it at `eb create` time with `--vpc.*` flags.)

### 5e. Deploy

```bash
eb deploy
```

Note the environment URL (e.g. `http://mkelectric-api-prod.xxxx.us-west-2.elasticbeanstalk.com`);
front it with HTTPS + a custom domain (`api.mkelectric.example.com`) via the EB load
balancer / ACM certificate.

### 5f. Run migrations + seed (one-time)

Run against the production DB from a machine that can reach RDS (an EB SSH session,
an EC2 bastion in the same VPC, or locally if RDS is temporarily reachable):

```bash
APP_ENV=production DATABASE_URL="postgresql://..." pnpm --filter @mkelectric/api db:migrate
APP_ENV=production DATABASE_URL="postgresql://..." \
  SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... pnpm --filter @mkelectric/api db:seed
```

> Change the seeded admin password after first login.

### Optional: App Runner instead of EB

If your AWS account is an **existing App Runner customer** (it closed to new customers
on 2026-04-30), you can use App Runner source-based deploy with the root `apprunner.yaml`
instead. Both run the same build → `node packages/api/dist/index.js` flow.

## Step 6 — Frontends (S3 + CloudFront)

For **each** app (web, admin):

1. Create S3 bucket + CloudFront distribution (SPA config: 403/404 → `/index.html`,
   response code 200, so client-side routing works).
2. Set the API URL in the app's `.env.production`:
   ```
   VITE_API_BASE_URL=https://api.mkelectric.example.com/api
   ```
3. Build + deploy:
   ```powershell
   # Windows
   ./deploy/deploy-frontend.ps1 -App web   -Bucket mkelectric-web-prod   -DistributionId E123ABC
   ./deploy/deploy-frontend.ps1 -App admin -Bucket mkelectric-admin-prod -DistributionId E456DEF
   ```
   ```bash
   # Linux / CI
   ./deploy/deploy-frontend.sh web   mkelectric-web-prod   E123ABC
   ./deploy/deploy-frontend.sh admin mkelectric-admin-prod E456DEF
   ```

## Step 7 — Cross-origin cookies (important)

The API sets JWTs as HttpOnly cookies. Because the frontends (CloudFront domains) and
the API (Elastic Beanstalk domain) are on **different origins**, verify:

- API `CORS_ORIGINS` lists the exact frontend URLs.
- Cookie behaviour is env-driven (no code change needed):
  - Same parent domain (e.g. `api.mkelectric.example.com` + `mkelectric.example.com`)
    → `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true` (default).
  - Unrelated cross-site domains → set `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`.

**Recommendation:** put the API and frontends under the same parent domain
(`api.` / `admin.` / root) so `SameSite=Lax` keeps working and cookies stay first-party.

---

## Deployment checklist

- [ ] EB environment in the same VPC as RDS; SG allows EB → RDS on 5432
- [ ] S3 media bucket + CloudFront created
- [ ] IAM instance profile has S3 + Secrets Manager access
- [ ] EB env created (`eb create`), secrets set (`eb setenv`)
- [ ] `eb deploy` succeeds, `/health` returns 200
- [ ] Migrations + seed run against RDS
- [ ] Frontend `.env.production` points at the API domain
- [ ] Frontends deployed to S3 + CloudFront (SPA fallback configured)
- [ ] CORS origins + cookie SameSite verified for your domain layout
- [ ] Seeded admin password changed
