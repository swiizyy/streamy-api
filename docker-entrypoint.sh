#!/bin/sh
set -e

echo "🚀 StreamyAPI starting..."

# Validate required env vars
if [ -z "$APP_KEY" ]; then
  echo "❌ ERROR: APP_KEY is required. Generate one with: node ace generate:key"
  exit 1
fi

# Run migrations only when explicitly enabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "📦 Running migrations..."
  node ace migration:run --force
else
  echo "⏭️ Skipping migrations (set RUN_MIGRATIONS=true to enable)"
fi

# Start the server
echo "✅ Starting server..."
node bin/server.js
