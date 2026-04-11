import Invite from '#models/invite'
import InviteQuota from '#models/invite_quota'
import Referral from '#models/referral'
import User from '#models/user'
import cache from '#services/cache'
import JellyfinAccountManager from '#services/jellyfin_account_manager'
import JellyfinClient from '#services/jellyfin_client'
import NotificationService from '#services/notification_service'
import env from '#start/env'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const inviteStoreValidator = vine.compile(
  vine.object({
    label: vine.string().trim().optional(),
    max_uses: vine.number().min(1).optional(),
    account_expiry_days: vine.number().min(1).optional(),
    allowed_libraries: vine.array(vine.string().trim()).optional(),
    max_streams: vine.number().min(1).optional(),
    expires_at: vine.string().optional(),
  })
)

const redeemValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(1),
    password: vine.string().minLength(8),
  })
)

type InviteValidity = { valid: true } | { valid: false; reason: string }

@inject()
export default class InvitesController {
  constructor(
    private notifications: NotificationService,
    private jellyfin: JellyfinClient,
    private jellyfinAccountManager: JellyfinAccountManager
  ) {}

  private validateInvite(invite: Invite | null): InviteValidity {
    if (!invite) {
      return { valid: false, reason: 'Code invalide' }
    }

    if (!invite.isActive) {
      return { valid: false, reason: 'Invitation desactivee' }
    }

    if (invite.expiresAt && invite.expiresAt <= DateTime.now()) {
      return { valid: false, reason: 'Invitation expiree' }
    }

    if (typeof invite.remainingUses === 'number' && invite.remainingUses <= 0) {
      return { valid: false, reason: 'Invitation epuisee' }
    }

    return { valid: true }
  }

  private checkRedeemRateLimit(ip: string): boolean {
    const key = `invite:redeem:${ip}`
    const currentAttempts = cache.get<number>(key) || 0

    if (currentAttempts >= 5) {
      return false
    }

    cache.set(key, currentAttempts + 1, 3600)
    return true
  }

  async store({ auth, request, response, inviteQuota }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(inviteStoreValidator)

    let expiresAt: DateTime | null = null
    if (payload.expires_at) {
      expiresAt = DateTime.fromISO(payload.expires_at)
      if (!expiresAt.isValid || expiresAt <= DateTime.now()) {
        return response.badRequest({ message: 'expires_at doit etre une date future valide' })
      }
    }

    const maxUses = payload.max_uses ?? null

    const invite = await Invite.create({
      createdBy: user.id,
      label: payload.label ?? null,
      maxUses,
      remainingUses: maxUses,
      accountExpiryDays: payload.account_expiry_days ?? null,
      allowedLibraries: payload.allowed_libraries ?? null,
      maxStreams: payload.max_streams ?? null,
      expiresAt,
      isActive: true,
    })

    if (user.role !== 'admin') {
      const quota =
        inviteQuota ||
        (await InviteQuota.firstOrCreate(
          { userId: user.id },
          { userId: user.id, maxInvites: env.get('DEFAULT_INVITE_QUOTA', 5), usedInvites: 0 }
        ))

      quota.usedInvites += 1
      await quota.save()
    }

    return response.created({
      ...invite.serialize(),
      url: `${env.get('APP_URL')}/join/${invite.code}`,
    })
  }

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const query = Invite.query().preload('creator').withCount('referrals')
    if (user.role !== 'admin') {
      query.where('created_by', user.id)
    }

    const invites = await query.orderBy('created_at', 'desc')
    return invites.map((invite) => ({
      ...invite.serialize(),
      referralsCount: Number(invite.$extras.referrals_count || 0),
      url: `${env.get('APP_URL')}/join/${invite.code}`,
    }))
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const invite = await Invite.findOrFail(params.id)

    if (user.role !== 'admin' && invite.createdBy !== user.id) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    invite.isActive = false
    await invite.save()

    return response.noContent()
  }

  async validate({ params }: HttpContext) {
    const invite = await Invite.findBy('code', params.code)
    const validity = this.validateInvite(invite)

    if (!validity.valid || !invite) {
      return validity
    }

    return {
      valid: true,
      label: invite.label,
      restrictions: {
        maxUses: invite.maxUses,
        remainingUses: invite.remainingUses,
        accountExpiryDays: invite.accountExpiryDays,
        allowedLibraries: invite.allowedLibraries,
        maxStreams: invite.maxStreams,
        expiresAt: invite.expiresAt,
      },
    }
  }

  async redeem({ auth, params, request, response }: HttpContext) {
    const ip = request.ip() || 'unknown'
    if (!this.checkRedeemRateLimit(ip)) {
      return response.tooManyRequests({ message: 'Trop de tentatives, reessayez plus tard' })
    }

    const payload = await request.validateUsing(redeemValidator)

    const invite = await Invite.findBy('code', params.code)
    const validity = this.validateInvite(invite)
    if (!validity.valid || !invite) {
      return response.badRequest(validity)
    }

    if (auth.user && auth.user.id === invite.createdBy) {
      return response.forbidden({ message: 'Vous ne pouvez pas utiliser votre propre invitation' })
    }

    const existingByUsername = await User.findBy('username', payload.username)
    if (existingByUsername) {
      return response.conflict({ message: 'Nom utilisateur deja utilise' })
    }

    let jellyfinUserId: string | null = null

    try {
      const createdJellyfinUser = await this.jellyfinAccountManager.createUser(
        payload.username,
        payload.password
      )
      jellyfinUserId = createdJellyfinUser.Id

      if (invite.allowedLibraries && invite.allowedLibraries.length > 0) {
        await this.jellyfinAccountManager.setAllowedLibraries(jellyfinUserId, invite.allowedLibraries)
      }

      if (invite.maxStreams) {
        await this.jellyfinAccountManager.setMaxStreams(jellyfinUserId, invite.maxStreams)
      }

      const jellyfinAuth = await this.jellyfin.authenticate(payload.username, payload.password)

      const result = await db.transaction(async (trx) => {
        const accountExpiresAt = invite.accountExpiryDays
          ? DateTime.now().plus({ days: invite.accountExpiryDays })
          : null

        const newUser = await User.create(
          {
            jellyfinId: jellyfinUserId!,
            username: payload.username,
            jellyfinToken: jellyfinAuth.AccessToken,
            role: 'user',
          },
          { client: trx }
        )

        const referral = await Referral.create(
          {
            inviteId: invite.id,
            sponsorId: invite.createdBy,
            referredUserId: newUser.id,
            jellyfinUserId: jellyfinUserId!,
            accountExpiresAt,
            status: 'active',
            notifiedExpiry: false,
          },
          { client: trx }
        )

        if (typeof invite.remainingUses === 'number') {
          invite.useTransaction(trx)
          invite.remainingUses = Math.max(0, invite.remainingUses - 1)
          await invite.save()
        }

        return { newUser, referral }
      })

      await this.notifications.notify(
        invite.createdBy,
        'new_referral',
        'Nouveau filleul',
        `${result.newUser.username} a rejoint via votre invitation.`
      )

      const token = await User.accessTokens.create(result.newUser)

      return response.created({
        user: {
          id: result.newUser.id,
          username: result.newUser.username,
          email: result.newUser.email,
          role: result.newUser.role,
        },
        referral: result.referral,
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
      })
    } catch (error) {
      if (jellyfinUserId) {
        await this.jellyfinAccountManager.deleteUser(jellyfinUserId).catch(() => {})
      }

      return response.badRequest({
        message: 'Impossible de creer le compte avec cette invitation',
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }

  async joinPage({ params, response }: HttpContext) {
    const invite = await Invite.findBy('code', params.code)
    const validity = this.validateInvite(invite)

    if (!validity.valid || !invite) {
      return response
        .type('text/html')
        .send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invitation invalide</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px;background:#0f172a;color:#e2e8f0;"><h1>Invitation invalide</h1><p>${validity.valid ? 'Code invalide' : validity.reason}</p></body></html>`)
    }

    const escapedCode = invite.code.replace(/"/g, '&quot;')
    const escapedLabel = (invite.label || 'Invitation standard').replace(/</g, '&lt;')

    return response.type('text/html').send(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Invitation Streamy</title>
    <style>
      body { margin:0; font-family:Segoe UI,sans-serif; background:#0f172a; color:#e2e8f0; padding:18px; }
      .card { max-width:640px; margin:0 auto; padding:20px; border:1px solid #334155; border-radius:12px; background:#111827; }
      input,button { width:100%; padding:10px; margin-top:8px; border-radius:8px; border:1px solid #334155; }
      button { background:#10b981; color:#03241b; font-weight:700; border:none; cursor:pointer; }
      #message { margin-top:10px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Rejoindre Streamy</h1>
      <p>${escapedLabel}</p>
      <p>Utilisations restantes: ${invite.remainingUses ?? 'illimite'}</p>
      <p>Expiration du compte: ${invite.accountExpiryDays ? `${invite.accountExpiryDays} jours` : 'Aucune'}</p>
      <p>Max streams: ${invite.maxStreams ?? 'Par defaut'}</p>
      <form id="joinForm">
        <input name="username" placeholder="Username" required minlength="1" />
        <input name="password" type="password" placeholder="Password" required minlength="8" />
        <input name="confirm" type="password" placeholder="Confirmation password" required minlength="8" />
        <button type="submit">Creer mon compte</button>
      </form>
      <p id="message"></p>
    </div>
    <script>
      const form = document.getElementById('joinForm');
      const message = document.getElementById('message');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.textContent = '';
        const data = new FormData(form);
        const username = String(data.get('username') || '');
        const password = String(data.get('password') || '');
        const confirm = String(data.get('confirm') || '');
        if (password !== confirm) {
          message.textContent = 'Les mots de passe ne correspondent pas.';
          return;
        }
        const response = await fetch('/invites/${escapedCode}/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const body = await response.json();
        message.textContent = response.ok ? ('Compte cree. Token: ' + body.token.value) : (body.message || body.reason || 'Erreur');
      });
    </script>
  </body>
</html>`)
  }

  async libraries() {
    return this.jellyfinAccountManager.getLibraries()
  }
}
