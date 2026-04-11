import Referral from '#models/referral'
import JellyfinAccountManager from '#services/jellyfin_account_manager'
import NotificationService from '#services/notification_service'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

export default class ExpiredAccountsJob {
  constructor(
    private jellyfinAccountManager: JellyfinAccountManager = new JellyfinAccountManager(),
    private notifications: NotificationService = new NotificationService()
  ) {}

  async run(): Promise<void> {
    try {
      const now = DateTime.now()
      const notifyWindowDays = env.get('ACCOUNT_EXPIRY_NOTIFICATION_DAYS', 3)
      const notifyUntil = now.plus({ days: notifyWindowDays })

      const toNotify = await Referral.query()
        .where('status', 'active')
        .whereNotNull('account_expires_at')
        .where('notified_expiry', false)
        .where('account_expires_at', '>', now.toSQL()!)
        .where('account_expires_at', '<=', notifyUntil.toSQL()!)

      for (const referral of toNotify) {
        await this.notifications.notify(
          referral.referredUserId,
          'account_expiring',
          'Compte bientot expire',
          `Votre compte expirera le ${referral.accountExpiresAt?.toFormat('dd/MM/yyyy HH:mm')}.`
        )

        await this.notifications.notify(
          referral.sponsorId,
          'referral_expiring',
          'Filleul bientot expire',
          `Le compte de votre filleul #${referral.referredUserId} expirera bientot.`
        )

        referral.notifiedExpiry = true
        await referral.save()
      }

      const expiredReferrals = await Referral.query()
        .where('status', 'active')
        .whereNotNull('account_expires_at')
        .where('account_expires_at', '<', now.toSQL()!)

      for (const referral of expiredReferrals) {
        await this.jellyfinAccountManager.disableUser(referral.jellyfinUserId)
        referral.status = 'expired'
        await referral.save()

        await this.notifications.notify(
          referral.referredUserId,
          'account_expired',
          'Compte expire',
          'Votre compte a expire et a ete desactive automatiquement.'
        )

        await this.notifications.notify(
          referral.sponsorId,
          'referral_expired',
          'Filleul expire',
          `Le compte de votre filleul #${referral.referredUserId} a expire.`
        )
      }
    } catch (error) {
      logger.error({ error }, 'Expired accounts job failed')
    }
  }
}
