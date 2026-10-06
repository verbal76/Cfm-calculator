#!/usr/bin/env bash
# Local equivalent of CI (budget policy: prove it locally before spending Actions minutes).
#   scripts/local-check.sh          typecheck, lint, tests, web build, splash asset check, real-browser splash check (if available)
#   scripts/local-check.sh --fast   skip the real-browser splash check
# Not covered locally (needs the Android toolchain / release workflow): APK qualification, emulator smoke test.
set -euo pipefail
cd "$(dirname "$0")/.."
FAST=false; [ "${1:-}" = "--fast" ] && FAST=true

step() { printf '\n== %s\n' "$*"; }
step typecheck; npm run --silent typecheck
step lint;      npm run --silent lint
step tests;     npm test --silent
step "web build"; npm run --silent build
step "splash asset"; node scripts/verify-splash-asset.mjs

if $FAST; then echo; echo "skipped real-browser splash check (--fast)"; exit 0; fi
if ! python3 -c 'import playwright, PIL' 2>/dev/null; then
  echo; echo "skipped real-browser splash check: python 'playwright' and 'pillow' not installed (pip install playwright pillow)"; exit 0
fi
step "real-browser splash check"
OUT="$(mktemp -d)"
npx vite preview --port 4173 --host 127.0.0.1 > "$OUT/preview.log" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:4173/ >/dev/null && break; sleep 1; done
python3 scripts/splash_check.py http://127.0.0.1:4173 "$OUT/shots"
echo; echo "local check passed"
