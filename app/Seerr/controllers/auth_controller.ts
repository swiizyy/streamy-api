import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import JellyfinClient from '#services/jellyfin_client'
import { getPermissions } from '../helpers/permissions.js'

const localAuthValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(1),
    password: vine.string().minLength(1),
  })
)

/**
 * Seerr-compatible authentication controller.
 *
 * Exposes the `/api/v1/auth/*` endpoints expected by Overseerr / Jellyseerr
 * compatible clients (e.g. Streamyfin).  Authentication is delegated to
 * Jellyfin so that credentials remain consistent across the stack.
 *
 * Lives in `app/Seerr/controllers/` following the feature-based architecture
 * (Romain Lanz model) where each domain owns its own HTTP layer.
 */
@inject()
export default class SeerrAuthController {
  constructor(private jellyfin: JellyfinClient) {}

  /**
   * POST /api/v1/auth/local
   *
   * Authenticate with Jellyfin credentials and return an OAT alongside a
   * Seerr-compatible user payload.
   */
  async login({ request, response }: HttpContext) {
    const { username, password } = await request.validateUsing(localAuthValidator)

    let jellyfinAuth
    try {
      jellyfinAuth = await this.jellyfin.authenticate(username, password)
    } catch {
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    const { User: jfUser, AccessToken: jellyfinToken } = jellyfinAuth

    const user = await User.firstOrNew({ jellyfinId: jfUser.Id })

    // Sync admin status from Jellyfin on every login so that privilege changes
    // take effect immediately.  For non-admin users we only change the role when
    // the user is new (default to 'user') or when they are being demoted from
    // 'admin'.  This preserves the 'requester' role assigned by administrators.
    if (jfUser.Policy.IsAdministrator) {
      user.role = 'admin'
    } else if (user.$isNew) {
      user.role = 'user'
    } else if (user.role === 'admin') {
      // User was an admin but is no longer one in Jellyfin — revert to 'user'.
      user.role = 'user'
    }
    user.username = jfUser.Name
    user.jellyfinToken = jellyfinToken

    await user.save()

    const token = await User.accessTokens.create(user)

    return {
      id: user.id,
      displayName: user.username,
      email: user.email,
      avatar: user.avatarUrl,
      permissions: getPermissions(user.role),
      userType: 1 as const,
      token: {
        type: 'Bearer',
        value: token.value!.release(),
      },
    }
  }

  /**
   * GET /api/v1/auth/me
   *
   * Return the currently authenticated user in Seerr format.
   * Requires the `multiAuth` middleware (OAT or MediaBrowser token).
   */
  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    return {
      id: user.id,
      displayName: user.username,
      email: user.email,
      avatar: user.avatarUrl,
      permissions: getPermissions(user.role),
      userType: 1 as const,
    }
  }
}
