import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  async share(ctx: HttpContext) {
    const user = ctx.auth.user
    return {
      auth: user
        ? {
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
            },
          }
        : null,
    }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)
    await next()
    this.dispose(ctx)
  }
}
