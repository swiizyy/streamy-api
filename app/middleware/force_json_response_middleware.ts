import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

const INERTIA_ROUTES = ['/', '/login', '/search', '/requests', '/admin']

function isInertiaRoute(url: string): boolean {
  if (INERTIA_ROUTES.some((prefix) => url === prefix || url.startsWith(prefix + '/'))) {
    return true
  }
  return false
}

export default class ForceJsonResponseMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const url = ctx.request.url()
    // Skip JSON forcing for Inertia UI routes and Inertia XHR requests
    if (!isInertiaRoute(url) && !ctx.request.header('x-inertia')) {
      ctx.request.request.headers.accept = 'application/json'
    }
    return next()
  }
}
