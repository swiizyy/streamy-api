import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { NotificationAdapter, NotificationPayload } from './types.js'

export default class NtfyAdapter implements NotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    const ntfyUrl = env.get('NTFY_URL')
    const ntfyTopic = env.get('NTFY_TOPIC') || 'streamyapi'
    if (!ntfyUrl) return

    const url = `${ntfyUrl.replace(/\/$/, '')}/${ntfyTopic}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Title: payload.title,
        },
        body: payload.message,
      })
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Ntfy notification failed')
      }
    } catch (error) {
      logger.warn({ error }, 'Ntfy notification error')
    }
  }
}
