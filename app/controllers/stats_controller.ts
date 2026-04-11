import StatsAggregator from '#services/stats_aggregator'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

function parseDateParam(raw: string | undefined): DateTime | undefined {
  if (!raw) {
    return undefined
  }

  const parsed = DateTime.fromISO(raw)
  if (!parsed.isValid) {
    return undefined
  }

  return parsed
}

@inject()
export default class StatsController {
  constructor(private stats: StatsAggregator) {}

  async me({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const from = parseDateParam(request.input('from'))
    const to = parseDateParam(request.input('to'))

    if (request.input('from') && !from) {
      return response.badRequest({ message: 'Invalid from date' })
    }

    if (request.input('to') && !to) {
      return response.badRequest({ message: 'Invalid to date' })
    }

    return this.stats.getUserStats(user.id, from, to)
  }

  async user({ auth, params, request, response }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const targetUserId = Number(params.id)

    if (!Number.isFinite(targetUserId)) {
      return response.badRequest({ message: 'Invalid user id' })
    }

    if (currentUser.role !== 'admin' && currentUser.id !== targetUserId) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    const from = parseDateParam(request.input('from'))
    const to = parseDateParam(request.input('to'))

    if (request.input('from') && !from) {
      return response.badRequest({ message: 'Invalid from date' })
    }

    if (request.input('to') && !to) {
      return response.badRequest({ message: 'Invalid to date' })
    }

    return this.stats.getUserStats(targetUserId, from, to)
  }

  async global({ request, response }: HttpContext) {
    const from = parseDateParam(request.input('from'))
    const to = parseDateParam(request.input('to'))

    if (request.input('from') && !from) {
      return response.badRequest({ message: 'Invalid from date' })
    }

    if (request.input('to') && !to) {
      return response.badRequest({ message: 'Invalid to date' })
    }

    return this.stats.getGlobalStats(from, to)
  }

  async history({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const page = Number(request.input('page') || 1)
    const limit = Number(request.input('limit') || 20)
    const mediaType = request.input('type') as 'movie' | 'episode' | undefined
    const from = parseDateParam(request.input('from'))
    const to = parseDateParam(request.input('to'))

    if (!Number.isFinite(page) || page < 1) {
      return response.badRequest({ message: 'Invalid page' })
    }

    if (!Number.isFinite(limit) || limit < 1) {
      return response.badRequest({ message: 'Invalid limit' })
    }

    if (mediaType && !['movie', 'episode'].includes(mediaType)) {
      return response.badRequest({ message: 'Invalid type' })
    }

    if (request.input('from') && !from) {
      return response.badRequest({ message: 'Invalid from date' })
    }

    if (request.input('to') && !to) {
      return response.badRequest({ message: 'Invalid to date' })
    }

    let userId = Number(request.input('userId'))
    if (!Number.isFinite(userId)) {
      userId = user.id
    }

    if (user.role !== 'admin') {
      userId = user.id
    }

    return this.stats.getHistory({
      userId,
      mediaType,
      from,
      to,
      page,
      limit,
    })
  }

  async activity({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const groupByRaw = String(request.input('group_by') || 'day')
    const from = parseDateParam(request.input('from'))
    const to = parseDateParam(request.input('to'))

    if (!['day', 'week', 'month'].includes(groupByRaw)) {
      return response.badRequest({ message: 'Invalid group_by value' })
    }

    if (request.input('from') && !from) {
      return response.badRequest({ message: 'Invalid from date' })
    }

    if (request.input('to') && !to) {
      return response.badRequest({ message: 'Invalid to date' })
    }

    let userId = Number(request.input('userId'))
    if (!Number.isFinite(userId)) {
      userId = user.id
    }

    if (user.role !== 'admin') {
      userId = user.id
    }

    return this.stats.getActivity(userId, groupByRaw as 'day' | 'week' | 'month', from, to)
  }
}
