import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { NotificationAdapter, NotificationPayload } from './types.js'

const EVENT_COLORS: Record<string, number> = {
  'request.created': 3447003,
  'request.approved': 3066993,
  'request.rejected': 15158332,
  'media.available': 1752220,
}

export default class DiscordAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    const webhookUrl = env.get('DISCORD_WEBHOOK_URL')
    if (!webhookUrl) return

    const color = EVENT_COLORS[payload.event] ?? 3447003

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: payload.title,
              description: payload.message,
              color,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      })
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Discord webhook failed')
      }
    } catch (error) {
      logger.warn({ error }, 'Discord webhook error')
    }
  }
}
