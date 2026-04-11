import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import JellyfinClient from '#services/jellyfin_client'

const loginValidator = vine.create(
  vine.object({
    username: vine.string().trim().minLength(1),
    password: vine.string().minLength(1),
  })
)

@inject()
export default class AuthController {
  constructor(private jellyfin: JellyfinClient) {}

  /**
   * POST /auth/login
   * Authenticate via Jellyfin, upsert local user, return OAT.
   */
  async login({ request, response }: HttpContext) {
    const { username, password } = await request.validateUsing(loginValidator)

    let jellyfinAuth
    try {
      jellyfinAuth = await this.jellyfin.authenticate(username, password)
    } catch {
      return response.unauthorized({ message: 'Invalid Jellyfin credentials' })
    }

    const { User: jfUser, AccessToken: jellyfinToken } = jellyfinAuth

    // Fetch or initialise local user
    const user = await User.firstOrNew({ jellyfinId: jfUser.Id })

    if (user.$isNew) {
      // First time login — set role from Jellyfin policy
      user.role = jfUser.Policy.IsAdministrator ? 'admin' : 'user'
    }

    // Always refresh mutable fields
    user.username = jfUser.Name
    user.jellyfinToken = jellyfinToken

    await user.save()

    const token = await User.accessTokens.create(user)

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: {
        type: 'bearer',
        value: token.value!.release(),
      },
    }
  }

  /**
   * POST /auth/logout
   * Revoke the current access token.
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }
    return response.noContent()
  }

  /**
   * GET /auth/me
   * Return the authenticated user's profile.
   */
  async me({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
    }
  }
}
