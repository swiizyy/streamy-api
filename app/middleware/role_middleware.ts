import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized({ message: 'Authentication required' })
    }

    if (!options?.roles?.includes(user.role)) {
      return ctx.response.forbidden({ message: 'Insufficient permissions' })
    }

    return next()
  }
}
