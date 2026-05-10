import env from '#start/env'
import Notification from '#models/notification'
import NotificationSettings from '#models/notification_settings'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'
import DiscordAdapter from './notifications/discord_adapter.js'
import SlackAdapter from './notifications/slack_adapter.js'
import NtfyAdapter from './notifications/ntfy_adapter.js'
import SmtpAdapter from './notifications/smtp_adapter.js'
import type { NotificationPayload, NotificationAdapter } from './notifications/types.js'

export type { NotificationPayload }

export default class NotificationService {
  // ── In-app notifications (stored in DB) ─────────────────────────────────────

  async notify(userId: number, type: string, title: string, message: string): Promise<void> {
    await Notification.create({ userId, type, title, message, read: false })
  }

  async notifyAdmins(type: string, title: string, message: string): Promise<void> {
    const admins = await User.query().where('role', 'admin')
    await Promise.all(admins.map((admin) => this.notify(admin.id, type, title, message)))
  }

  // ── External channels (adapters) ────────────────────────────────────────────

  async broadcast(payload: NotificationPayload): Promise<void> {
    let settings: NotificationSettings
    try {
      settings = await NotificationSettings.getSettings()
    } catch {
      // Graceful degradation — table may not exist in some test environments
      logger.debug('notification_settings table unavailable, skipping broadcast')
      return
    }

    const adapters: NotificationAdapter[] = []

    if (settings.discordEnabled && env.get('DISCORD_WEBHOOK_URL')) {
      adapters.push(new DiscordAdapter())
    }
    if (settings.slackEnabled && env.get('SLACK_WEBHOOK_URL')) {
      adapters.push(new SlackAdapter())
    }
    if (settings.ntfyEnabled && env.get('NTFY_URL')) {
      adapters.push(new NtfyAdapter())
    }
    if (settings.smtpEnabled && env.get('SMTP_HOST')) {
      adapters.push(new SmtpAdapter())
    }

    await Promise.all(adapters.map((adapter) => adapter.send(payload).catch((e) => logger.warn({ e }, 'Adapter error'))))
  }

  // ── Legacy Discord helper (kept for backward compatibility) ──────────────────

  async sendDiscordWebhook(title: string, message: string, color: number = 3447003): Promise<void> {
    const webhookUrl = env.get('DISCORD_WEBHOOK_URL')
    if (!webhookUrl) return

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ title, description: message, color, timestamp: new Date().toISOString() }],
        }),
      })
      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to send Discord webhook')
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to send Discord webhook')
    }
  }
}
