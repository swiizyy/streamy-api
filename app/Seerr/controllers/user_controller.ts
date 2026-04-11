import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import User from '#models/user'
import { SeerrUserTransformer } from '../transformers/seerr_transformer.js'

const userListValidator = vine.compile(
  vine.object({
    take: vine.number().positive().optional(),
    skip: vine.number().min(0).optional(),
    sort: vine.enum(['created', 'updated', 'displayname'] as const).optional(),
    sortDirection: vine.enum(['asc', 'desc'] as const).optional(),
    q: vine.string().trim().optional(),
  })
)

/**
 * Seerr-compatible user management controller.
 *
 * Exposes minimal user-related endpoints that Seerr-compatible clients
 * (e.g. Streamyfin) rely on:
 *
 *   GET /api/v1/user          – paginated user list (admin only)
 *   GET /api/v1/user/:userId  – single user (admin or self)
 */
export default class SeerrUserController {
  /**
   * GET /api/v1/user
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Admin role required' })
    }

    const { take = 25, skip = 0, sort = 'created', sortDirection = 'asc', q } =
      await request.validateUsing(userListValidator)

    const columnMap: Record<string, string> = {
      created: 'created_at',
      updated: 'updated_at',
      displayname: 'username',
    }

    const query = User.query().orderBy(columnMap[sort] ?? 'created_at', sortDirection)

    if (q) {
      query.whereILike('username', `%${q}%`)
    }

    const total = await query.clone().count('* as c').first()
    const users = await query.offset(skip).limit(take)

    const page = Math.floor(skip / take) + 1
    const totalCount = Number(total?.$extras.c ?? 0)
    const pages = Math.ceil(totalCount / take) || 1

    return {
      pageInfo: { page, pages, results: totalCount },
      results: users.map((u) => SeerrUserTransformer.transform(u)),
    }
  }

  /**
   * GET /api/v1/user/:userId
   */
  async show({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const targetId = parseInt(params.userId, 10)

    if (Number.isNaN(targetId)) {
      return response.badRequest({ message: 'Invalid user ID' })
    }

    if (currentUser.role !== 'admin' && currentUser.id !== targetId) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    const target = await User.find(targetId)

    if (!target) {
      return response.notFound({ message: 'User not found' })
    }

    return SeerrUserTransformer.transform(target)
  }
}
