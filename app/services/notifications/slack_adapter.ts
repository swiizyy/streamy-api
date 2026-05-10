import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { NotificationAdapter, NotificationPayload } from './types.js'

export default class SlackAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    const webhookUrl = env.get('SLACK_WEBHOOK_URL')
    if (!webhookUrl) return

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: payload.title, emoji: true },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: payload.message },
            },
          ],
        }),
      })
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Slack webhook failed')
      }
    } catch (error) {
      logger.warn({ error }, 'Slack webhook error')
    }
  }
}
