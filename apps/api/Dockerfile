FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc \
  && npx tsc prisma/seed.ts prisma/seed-demo-products.ts \
    --outDir dist/prisma \
    --esModuleInterop \
    --skipLibCheck \
    --module commonjs \
    --target ES2020 \
    --moduleResolution node \
    --strict false

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
