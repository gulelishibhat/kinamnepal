#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Deploy a frontend (web or admin) to S3 + CloudFront.
#  Usage (from repo root):
#    ./deploy/deploy-frontend.sh web   mkelectric-web-prod   E123ABC
#    ./deploy/deploy-frontend.sh admin mkelectric-admin-prod E456DEF
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

APP="${1:?Usage: deploy-frontend.sh <web|admin> <bucket> <distributionId> [region]}"
BUCKET="${2:?bucket required}"
DISTRIBUTION_ID="${3:?distributionId required}"
REGION="${4:-us-west-2}"

PKG="@mkelectric/${APP}"
DIST_DIR="apps/${APP}/dist"

echo "==> Building ${PKG} (production)..."
pnpm --filter "@mkelectric/shared" build
pnpm --filter "${PKG}" build

[ -d "${DIST_DIR}" ] || { echo "Build output not found at ${DIST_DIR}"; exit 1; }

echo "==> Syncing hashed assets to s3://${BUCKET} (long cache)..."
aws s3 sync "${DIST_DIR}" "s3://${BUCKET}" \
  --region "${REGION}" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

echo "==> Uploading index.html (no cache)..."
aws s3 cp "${DIST_DIR}/index.html" "s3://${BUCKET}/index.html" \
  --region "${REGION}" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

echo "==> Invalidating CloudFront ${DISTRIBUTION_ID}..."
aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*" >/dev/null

echo "==> Done. ${APP} deployed."
