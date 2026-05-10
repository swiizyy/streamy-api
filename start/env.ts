/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Jellyfin
  JELLYFIN_URL: Env.schema.string({ format: 'url', tld: false }),
  JELLYFIN_API_KEY: Env.schema.string(),
  JELLYFIN_WEBHOOK_SECRET: Env.schema.string.optional(),

  // TMDB
  TMDB_API_KEY: Env.schema.string(),
  TMDB_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Download sync
  DOWNLOAD_SYNC_INTERVAL_SECONDS: Env.schema.number.optional(),

  // Invites & referrals
  DEFAULT_INVITE_QUOTA: Env.schema.number.optional(),
  ACCOUNT_EXPIRY_NOTIFICATION_DAYS: Env.schema.number.optional(),
  CACHE_VIEWS: Env.schema.boolean.optional(),

  // Notifications — webhooks
  DISCORD_WEBHOOK_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  SLACK_WEBHOOK_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  NTFY_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  NTFY_TOPIC: Env.schema.string.optional(),

  // Notifications — SMTP
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
  MAIL_FROM: Env.schema.string.optional(),

  // Radarr (default instance via env, overridden by ServiceInstance if configured)
  RADARR_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  RADARR_API_KEY: Env.schema.string.optional(),

  // Sonarr
  SONARR_URL: Env.schema.string.optional({ format: 'url', tld: false }),
  SONARR_API_KEY: Env.schema.string.optional(),

  // TVDB
  TVDB_API_KEY: Env.schema.string.optional(),
  TVDB_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Redis (BullMQ)
  REDIS_HOST: Env.schema.string.optional(),
  REDIS_PORT: Env.schema.number.optional(),
})

