import type { HttpContext } from '@adonisjs/core/http'
import { renderPage } from '#services/inertia_render'

export default class InertiaAuthController {
  async loginPage(ctx: HttpContext) {
    const { auth, response } = ctx
    if (await auth.check()) {
      return response.redirect('/')
    }
    return renderPage(ctx, 'auth/login', {})
  }
}
