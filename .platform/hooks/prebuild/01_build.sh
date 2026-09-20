#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  Elastic Beanstalk prebuild hook (Amazon Linux 2023, Node.js 22).
#  Installs pnpm (corepack is absent on AL2023), installs the API +
#  shared deps, and compiles TypeScript so packages/api/dist/index.js
#  exists for the Procfile.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

echo "[prebuild] Installing pnpm..."
npm install -g pnpm@9.15.9

echo "[prebuild] Installing dependencies (api + shared)..."
pnpm install --frozen-lockfile=false \
  --filter @mkelectric/shared... \
  --filter @mkelectric/api...

echo "[prebuild] Building shared + api..."
pnpm --filter @mkelectric/shared build
pnpm --filter @mkelectric/api build

echo "[prebuild] Done. dist/index.js ready."
