#!/usr/bin/env bash
set -euo pipefail

echo "Using Node $(node --version)"

echo "Installing API dependencies..."
npm --prefix apps/api install --include=dev

echo "Generating Prisma client for API..."
npm --prefix apps/api run db:generate

echo "Installing Web dependencies..."
npm --prefix apps/web install --include=dev

echo "Cloud agent setup complete."
