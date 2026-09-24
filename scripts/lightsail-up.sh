#!/usr/bin/env bash
# Boot the marketplace on an Ubuntu Lightsail instance.
# Networking: Lightsail firewall must allow TCP 80 (and 443 if you add TLS later).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo systemctl enable --now docker
fi

docker_cmd() {
  if docker info >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

if [ ! -f .env ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "openssl is required to generate .env secrets"
    exit 1
  fi
  PUBLIC_IP="$(curl -fsS --max-time 5 https://checkip.amazonaws.com || true)"
  PUBLIC_IP="$(printf '%s' "$PUBLIC_IP" | tr -d '[:space:]')"
  if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="YOUR_STATIC_IP"
  fi
  JWT_SECRET="$(openssl rand -hex 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  cat > .env <<EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=african_fashion
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=http://${PUBLIC_IP}
HTTP_PORT=80
SEED_ON_BOOT=true
SEED_DEMO_PRODUCTS=true
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
VITE_STRIPE_PUBLIC_KEY=
EOF
  chmod 600 .env
  echo "Created .env with generated database and JWT secrets."
  echo "Public URL set to http://${PUBLIC_IP}"
fi

echo "Building and starting containers..."
docker_cmd compose up -d --build

echo "Waiting for the site..."
HTTP_PORT="$(grep -E '^HTTP_PORT=' .env | cut -d= -f2- || true)"
HTTP_PORT="${HTTP_PORT:-80}"
ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${HTTP_PORT}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 5
done

if [ "$ready" -ne 1 ]; then
  echo "The site did not become healthy. Recent API logs:"
  docker_cmd compose logs --tail 80 api
  exit 1
fi

echo "Marketplace is up on port ${HTTP_PORT}."
echo "Admin: admin@africanfashion.com / Admin123!"
echo "Customer: customer@example.com / Customer123!"
