import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import MediaRequest from '#models/media_request'
import StatsAggregator from '#services/stats_aggregator'
import { renderPage } from '#services/inertia_render'

@inject()
export default class DashboardController {
  constructor(private stats: StatsAggregator) {}

  async index(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()

    const [recentRequests, userStats] = await Promise.all([
      MediaRequest.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
        .limit(5),
      this.stats.getUserStats(user.id).catch(() => null),
    ])

    return renderPage(ctx, 'dashboard', {
      recentRequests: recentRequests.map((r) => r.serialize()),
      stats: userStats,
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }
}
