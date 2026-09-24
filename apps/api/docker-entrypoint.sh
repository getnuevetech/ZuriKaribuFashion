#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET is required"
  exit 1
fi

echo "Applying database schema..."
attempt=0
while true; do
  set +e
  output="$(npx prisma db push --skip-generate 2>&1)"
  status=$?
  set -e
  printf '%s\n' "$output"
  if [ "$status" -eq 0 ]; then
    break
  fi
  if ! printf '%s\n' "$output" | grep -q 'P1001'; then
    echo "Database schema sync failed"
    exit 1
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Database not ready"
    exit 1
  fi
  echo "Database not ready (attempt ${attempt}), retrying..."
  sleep 2
done

if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "Seeding accounts and banners..."
  node dist/prisma/seed.js
fi

if [ "${SEED_DEMO_PRODUCTS:-false}" = "true" ]; then
  echo "Seeding demo products..."
  node dist/prisma/seed-demo-products.js
fi

echo "Starting API..."
exec node dist/index.js
