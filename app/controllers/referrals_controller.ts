import InviteQuota from '#models/invite_quota'
import Referral from '#models/referral'
import JellyfinAccountManager from '#services/jellyfin_account_manager'
import NotificationService from '#services/notification_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

const extendReferralValidator = vine.compile(
  vine.object({
    days: vine.number().min(1),
  })
)

const quotaValidator = vine.compile(
  vine.object({
    max_invites: vine.number().min(0),
  })
)

@inject()
export default class ReferralsController {
  constructor(
    private jellyfinAccountManager: JellyfinAccountManager,
    private notifications: NotificationService
  ) {}

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const sponsored = await Referral.query()
      .where('sponsor_id', user.id)
      .preload('referredUser')
      .preload('invite')
      .orderBy('created_at', 'desc')

    const sponsoredBy = await Referral.query()
      .where('referred_user_id', user.id)
      .preload('sponsor')
      .preload('invite')
      .first()

    return {
      sponsored,
      sponsoredBy,
    }
  }

  async tree() {
    const referrals = await Referral.query().orderBy('created_at', 'asc')

    return referrals.map((referral) => ({
      id: referral.id,
      sponsor_id: referral.sponsorId,
      referred_user_id: referral.referredUserId,
      invite_id: referral.inviteId,
      status: referral.status,
      account_expires_at: referral.accountExpiresAt,
      created_at: referral.createdAt,
    }))
  }

  async revoke({ params }: HttpContext) {
    const referral = await Referral.findOrFail(params.id)

    await this.jellyfinAccountManager.disableUser(referral.jellyfinUserId)

    referral.status = 'revoked'
    await referral.save()

    await this.notifications.notify(
      referral.sponsorId,
      'referral_revoked',
      'Filleul revoque',
      `Le compte du filleul #${referral.referredUserId} a ete revoque.`
    )

    await this.notifications.notify(
      referral.referredUserId,
      'account_revoked',
      'Compte revoque',
      'Votre compte a ete revoque par un administrateur.'
    )

    return referral
  }

  async extend({ params, request }: HttpContext) {
    const payload = await request.validateUsing(extendReferralValidator)
    const referral = await Referral.findOrFail(params.id)

    const baseDate = referral.accountExpiresAt || referral.createdAt
    referral.accountExpiresAt = baseDate.plus({ days: payload.days })
    referral.status = 'active'
    referral.notifiedExpiry = false
    await referral.save()

    await this.notifications.notify(
      referral.referredUserId,
      'account_extended',
      'Expiration prolongee',
      `Votre compte a ete prolonge de ${payload.days} jour(s).`
    )

    return referral
  }

  async updateQuota({ params, request }: HttpContext) {
    const payload = await request.validateUsing(quotaValidator)

    const quota = await InviteQuota.firstOrCreate(
      { userId: Number(params.id) },
      { userId: Number(params.id), maxInvites: payload.max_invites, usedInvites: 0 }
    )

    quota.maxInvites = payload.max_invites

    if (quota.usedInvites > quota.maxInvites) {
      quota.usedInvites = quota.maxInvites
    }

    await quota.save()

    return quota
  }
}
