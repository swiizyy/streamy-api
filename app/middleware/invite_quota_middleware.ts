import InviteQuota from '#models/invite_quota'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class InviteQuotaMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    if (user.role === 'admin') {
      return next()
    }

    const defaultQuota = env.get('DEFAULT_INVITE_QUOTA', 5)

    const quota = await InviteQuota.firstOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        maxInvites: defaultQuota,
        usedInvites: 0,
      }
    )

    if (!quota.hasQuotaRemaining()) {
      return ctx.response.forbidden({ message: "Quota d'invitations épuisé" })
    }

    ctx.inviteQuota = quota
    return next()
  }
}
