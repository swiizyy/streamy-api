import env from '#start/env'
import Notification from '#models/notification'
import User from '#models/user'
import logger from '@adonisjs/core/services/logger'

export default class NotificationService {
  async notify(userId: number, type: string, title: string, message: string): Promise<void> {
    await Notification.create({
      userId,
      type,
      title,
      message,
      read: false,
    })
  }

  async notifyAdmins(type: string, title: string, message: string): Promise<void> {
    const admins = await User.query().where('role', 'admin')
    await Promise.all(admins.map((admin) => this.notify(admin.id, type, title, message)))
  }

  async sendDiscordWebhook(title: string, message: string, color: number = 3447003): Promise<void> {
    const webhookUrl = env.get('DISCORD_WEBHOOK_URL')

    if (!webhookUrl) {
      return
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description: message,
              color,
              timestamp: new Date().toISOString(),
            },
          ],
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
