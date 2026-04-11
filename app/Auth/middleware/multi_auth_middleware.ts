import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Extracts a MediaBrowser token from an Authorization header value.
 * Supports the format: MediaBrowser Token="<token>", ...
 */
function extractMediaBrowserToken(authHeader: string): string | null {
  const match = authHeader.match(/MediaBrowser[^,]*\bToken="([^"]+)"/)
  return match?.[1] ?? null
}

/**
 * MultiAuthMiddleware handles authentication for both OAT (Opaque Access Tokens)
 * and MediaBrowser tokens (Jellyfin-style authentication).
 *
 * Resolution order:
 * 1. Bearer <oat> — standard StreamyAPI token issued on login.
 * 2. Authorization: MediaBrowser Token="<jellyfinToken>" — Jellyfin / Emby header.
 * 3. X-Emby-Token / X-MediaBrowser-Token request headers.
 *
 * Place this middleware in app/Auth to keep authentication logic domain-isolated.
 */
export default class MultiAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const authHeader = ctx.request.header('authorization') ?? ''

    // ── 1. OAT Bearer token ────────────────────────────────────────────────────
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      try {
        await ctx.auth.authenticate()
        return next()
      } catch {
        // Fall through to MediaBrowser path so clients that accidentally send
        // both header formats are still handled gracefully.
      }
    }

    // ── 2. MediaBrowser token (multiple header sources) ───────────────────────
    const mediaBrowserToken =
      extractMediaBrowserToken(authHeader) ??
      ctx.request.header('x-emby-token') ??
      ctx.request.header('x-mediabrowser-token')

    if (mediaBrowserToken) {
      const user = await User.query().where('jellyfinToken', mediaBrowserToken).first()

      if (user) {
        // The AccessTokensGuard exposes `user`, `isAuthenticated`, and
        // `authenticationAttempted` as public instance properties (see guard.d.ts).
        // We set them directly because there is no public "setUser" API in
        // AdonisJS v7 access-tokens guard.  This is intentional and allows
        // downstream controllers to call `auth.getUserOrFail()` as usual.
        // Note: if the guard's internal shape changes in a future AdonisJS
        // release, this block will need to be revisited.
        const guard = ctx.auth.use('api') as {
          user: User | undefined
          isAuthenticated: boolean
          authenticationAttempted: boolean
        }
        guard.user = user
        guard.isAuthenticated = true
        guard.authenticationAttempted = true
        return next()
      }
    }

    ctx.response.unauthorized({ message: 'Authentication required' })
    return
  }
}
