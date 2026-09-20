# ═══════════════════════════════════════════════════════════════════
#  Deploy a frontend (web or admin) to S3 + CloudFront.
#
#  Prereqs: AWS CLI configured (aws configure), pnpm installed.
#  Usage (from repo root):
#    ./deploy/deploy-frontend.ps1 -App web   -Bucket mkelectric-web-prod   -DistributionId E123ABC
#    ./deploy/deploy-frontend.ps1 -App admin -Bucket mkelectric-admin-prod -DistributionId E456DEF
# ═══════════════════════════════════════════════════════════════════
param(
  [Parameter(Mandatory = $true)][ValidateSet('web', 'admin')][string]$App,
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$DistributionId,
  [string]$Region = 'us-west-2'
)

$ErrorActionPreference = 'Stop'
$pkg = "@mkelectric/$App"
$distDir = "apps/$App/dist"

Write-Host "==> Building $pkg (production)..." -ForegroundColor Cyan
# Ensure the shared package is built first, then the app in production mode
pnpm --filter "@mkelectric/shared" build
pnpm --filter $pkg build

if (-not (Test-Path $distDir)) {
  throw "Build output not found at $distDir"
}

Write-Host "==> Syncing hashed assets to s3://$Bucket (long cache)..." -ForegroundColor Cyan
# Hashed asset files can be cached forever
aws s3 sync $distDir "s3://$Bucket" `
  --region $Region `
  --delete `
  --exclude "index.html" `
  --cache-control "public, max-age=31536000, immutable"

Write-Host "==> Uploading index.html (no cache)..." -ForegroundColor Cyan
# index.html must never be cached so new deploys are picked up
aws s3 cp "$distDir/index.html" "s3://$Bucket/index.html" `
  --region $Region `
  --cache-control "no-cache, no-store, must-revalidate" `
  --content-type "text/html"

Write-Host "==> Invalidating CloudFront distribution $DistributionId..." -ForegroundColor Cyan
aws cloudfront create-invalidation `
  --distribution-id $DistributionId `
  --paths "/*" | Out-Null

Write-Host "==> Done. $App deployed to s3://$Bucket and CloudFront invalidated." -ForegroundColor Green
