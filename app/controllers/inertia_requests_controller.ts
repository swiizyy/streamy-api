import type { HttpContext } from '@adonisjs/core/http'
import MediaRequest from '#models/media_request'
import { renderPage } from '#services/inertia_render'

export default class InertiaRequestsController {
  async index(ctx: HttpContext) {
    const { auth, request } = ctx
    const user = auth.getUserOrFail()
    const page = Number(request.input('page', 1))

    const requests = await MediaRequest.query()
      .where('user_id', user.id)
      .preload('user')
      .orderBy('created_at', 'desc')
      .paginate(page, 20)

    return renderPage(ctx, 'requests/index', {
      requests: requests.serialize(),
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }

  async show(ctx: HttpContext) {
    const { auth, params, response } = ctx
    const user = auth.getUserOrFail()

    const mediaRequest = await MediaRequest.query()
      .where('id', params.id)
      .preload('user')
      .firstOrFail()

    if (user.role !== 'admin' && mediaRequest.userId !== user.id) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    return renderPage(ctx, 'requests/show', {
      request: mediaRequest.serialize(),
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }
}
