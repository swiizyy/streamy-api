# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copie package files d'abord (cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copie le reste du code
COPY . .

# Build TypeScript → JavaScript
RUN node ace build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

# Metadata
LABEL maintainer="StreamyAPI"
LABEL description="Unified API for Streamyfin — replaces Overseerr + StreamyStats + JFA-GO + Wizarr"

WORKDIR /app

# Dépendances de production uniquement
COPY --from=builder /app/build/package.json /app/build/package-lock.json ./
RUN npm ci --omit=dev

# Copier le build
COPY --from=builder /app/build .

# Créer un user non-root
RUN addgroup -S streamy && adduser -S streamy -G streamy
RUN mkdir -p /app/data && chown -R streamy:streamy /app/data
USER streamy

# Port
EXPOSE 3333

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

# Entrypoint
COPY --chown=streamy:streamy docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
