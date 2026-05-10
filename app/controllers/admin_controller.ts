import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import MediaRequest from '#models/media_request'
import User from '#models/user'
import NotificationSettings from '#models/notification_settings'
import StatsAggregator from '#services/stats_aggregator'
import { renderPage } from '#services/inertia_render'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const notificationSettingsValidator = vine.compile(
  vine.object({
    smtp_enabled: vine.boolean().optional(),
    discord_enabled: vine.boolean().optional(),
    slack_enabled: vine.boolean().optional(),
    ntfy_enabled: vine.boolean().optional(),
  })
)

@inject()
export default class AdminController {
  constructor(private stats: StatsAggregator) {}

  async requests(ctx: HttpContext) {
    const { request, auth } = ctx
    const user = auth.getUserOrFail()
    const page = Number(request.input('page', 1))

    const requests = await MediaRequest.query()
      .preload('user')
      .orderBy('created_at', 'desc')
      .paginate(page, 20)

    return renderPage(ctx, 'admin/requests', {
      requests: requests.serialize(),
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }

  async adminStats(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const from = DateTime.now().minus({ days: 30 })

    const [globalStats, activityData] = await Promise.all([
      this.stats.getGlobalStats(from),
      this.stats.getActivity(undefined, 'day', from),
    ])

    return renderPage(ctx, 'admin/stats', {
      stats: globalStats,
      activity: activityData,
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }

  async users(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const users = await User.query().orderBy('created_at', 'desc')

    return renderPage(ctx, 'admin/users', {
      users: users.map((u) => u.serialize()),
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }

  async settings(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail()
    const notifications = await NotificationSettings.getSettings()

    return renderPage(ctx, 'admin/settings', {
      notifications: {
        smtp_enabled: notifications.smtpEnabled,
        discord_enabled: notifications.discordEnabled,
        slack_enabled: notifications.slackEnabled,
        ntfy_enabled: notifications.ntfyEnabled,
      },
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }

  async updateNotificationSettings({ request, response }: HttpContext) {
    const payload = await request.validateUsing(notificationSettingsValidator)
    const settings = await NotificationSettings.getSettings()

    if (payload.smtp_enabled !== undefined) settings.smtpEnabled = payload.smtp_enabled
    if (payload.discord_enabled !== undefined) settings.discordEnabled = payload.discord_enabled
    if (payload.slack_enabled !== undefined) settings.slackEnabled = payload.slack_enabled
    if (payload.ntfy_enabled !== undefined) settings.ntfyEnabled = payload.ntfy_enabled

    await settings.save()
    return response.ok({ message: 'Settings updated' })
  }
}
