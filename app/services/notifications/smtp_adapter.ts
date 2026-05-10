import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import nodemailer from 'nodemailer'
import type { NotificationAdapter, NotificationPayload } from './types.js'

export default class SmtpAdapter implements NotificationAdapter {
  private transporter() {
    return nodemailer.createTransport({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT') || 587,
      auth:
        env.get('SMTP_USER') && env.get('SMTP_PASSWORD')
          ? { user: env.get('SMTP_USER'), pass: env.get('SMTP_PASSWORD') }
          : undefined,
    })
  }

  async send(payload: NotificationPayload): Promise<void> {
    if (!env.get('SMTP_HOST')) return

    const from = env.get('MAIL_FROM') || 'noreply@streamyapi'
    const to = payload.user?.email

    if (!to) return

    try {
      await this.transporter().sendMail({
        from,
        to,
        subject: payload.title,
        text: payload.message,
        html: `<p>${payload.message}</p>`,
      })
    } catch (error) {
      logger.warn({ error }, 'SMTP notification failed')
    }
  }
}
