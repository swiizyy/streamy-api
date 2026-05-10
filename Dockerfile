# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── Stage 2: Build (TypeScript + Vite) ───────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN node ace build && npx vite build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:22-slim AS prod

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

EXPOSE 3333

CMD ["node", "build/bin/server.js"]
