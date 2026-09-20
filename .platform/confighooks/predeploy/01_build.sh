#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  EB CONFIG hook — runs on configuration-only updates (e.g. env var
#  changes). Mirrors the prebuild hook so dist/ is rebuilt and the app
#  can start after a config flip. Same steps as hooks/prebuild.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

echo "[confighook] Installing pnpm..."
npm install -g pnpm@9.15.9

echo "[confighook] Installing dependencies (api + shared)..."
pnpm install --frozen-lockfile=false \
  --filter @mkelectric/shared... \
  --filter @mkelectric/api...

echo "[confighook] Building shared + api..."
pnpm --filter @mkelectric/shared build
pnpm --filter @mkelectric/api build

echo "[confighook] Done. dist/index.js ready."
