import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import Invite from '#models/invite'
import InviteQuota from '#models/invite_quota'
import Referral from '#models/referral'
import User from '#models/user'
import ExpiredAccountsJob from '#jobs/expired_accounts_job'
import JellyfinClient from '#services/jellyfin_client'
import JellyfinAccountManager from '#services/jellyfin_account_manager'

async function makeUser(role: 'admin' | 'user' | 'requester', suffix: string) {
  const user = await User.create({
    jellyfinId: `jf-${role}-${suffix}`,
    username: `${role}-${suffix}`,
    jellyfinToken: `token-${role}-${suffix}`,
    role,
  })

  const token = await User.accessTokens.create(user)
  return { user, bearer: token.value!.release() }
}

type JellyfinManagerOverrides = {
  createUser?: (username: string, password: string) => Promise<{ Id: string; Name: string }>
  setAllowedLibraries?: (jellyfinUserId: string, libraryIds: string[]) => Promise<void>
  setMaxStreams?: (jellyfinUserId: string, maxStreams: number) => Promise<void>
  disableUser?: (jellyfinUserId: string) => Promise<void>
  deleteUser?: (jellyfinUserId: string) => Promise<void>
  getLibraries?: () => Promise<{ id: string; name: string }[]>
}

function fakeJellyfinClient() {
  class FakeJellyfinClient extends JellyfinClient {
    async authenticate(username: string) {
      return {
        User: {
          Id: `jf-created-${username}`,
          Name: username,
          HasPassword: true,
          HasConfiguredPassword: true,
          Policy: {
            IsAdministrator: false,
            IsDisabled: false,
            EnableAllFolders: true,
          },
        },
        AccessToken: `jf-token-${username}`,
        ServerId: 'server-001',
      }
    }
  }

  app.container.swap(JellyfinClient, () => new FakeJellyfinClient())
}

function fakeJellyfinAccountManager(overrides: JellyfinManagerOverrides = {}) {
  class FakeJellyfinAccountManager extends JellyfinAccountManager {
    async createUser(username: string, password: string) {
      if (overrides.createUser) return overrides.createUser(username, password)
      return { Id: `jf-created-${username}`, Name: username } as any
    }

    async setAllowedLibraries(jellyfinUserId: string, libraryIds: string[]) {
      if (overrides.setAllowedLibraries) {
        return overrides.setAllowedLibraries(jellyfinUserId, libraryIds)
      }
      return
    }

    async setMaxStreams(jellyfinUserId: string, maxStreams: number) {
      if (overrides.setMaxStreams) {
        return overrides.setMaxStreams(jellyfinUserId, maxStreams)
      }
      return
    }

    async disableUser(jellyfinUserId: string) {
      if (overrides.disableUser) {
        return overrides.disableUser(jellyfinUserId)
      }
      return
    }

    async deleteUser(jellyfinUserId: string) {
      if (overrides.deleteUser) {
        return overrides.deleteUser(jellyfinUserId)
      }
      return
    }

    async getLibraries() {
      if (overrides.getLibraries) {
        return overrides.getLibraries()
      }
      return [{ id: 'lib-1', name: 'Films' }]
    }
  }

  app.container.swap(JellyfinAccountManager, () => new FakeJellyfinAccountManager())
}

test.group('Phase 5 - Invitations et parrainage', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.each.setup(() => {
    fakeJellyfinClient()
    fakeJellyfinAccountManager()
  })

  group.each.teardown(() => {
    app.container.restore(JellyfinClient)
    app.container.restore(JellyfinAccountManager)
  })

  test('cree une invitation avec quota restant', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'invite-ok')

    await InviteQuota.create({
      userId: user.id,
      maxInvites: 2,
      usedInvites: 0,
    })

    const response = await client
      .post('/invites')
      .header('Authorization', `Bearer ${bearer}`)
      .json({
        label: 'Mes amis',
        max_uses: 3,
      })

    response.assertStatus(201)
    assert.property(response.body(), 'code')
    assert.property(response.body(), 'url')

    const quota = await InviteQuota.findByOrFail('user_id', user.id)
    assert.equal(quota.usedInvites, 1)
  })

  test('bloque la creation si quota epuise', async ({ client }) => {
    const { user, bearer } = await makeUser('user', 'invite-ko')

    await InviteQuota.create({
      userId: user.id,
      maxInvites: 1,
      usedInvites: 1,
    })

    const response = await client
      .post('/invites')
      .header('Authorization', `Bearer ${bearer}`)
      .json({ label: 'Nope' })

    response.assertStatus(403)
  })

  test('valide un code invite selon son etat', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'validate')

    const validInvite = await Invite.create({
      createdBy: user.id,
      label: 'Valide',
      isActive: true,
      remainingUses: 1,
    })

    const expiredInvite = await Invite.create({
      createdBy: user.id,
      label: 'Expiree',
      isActive: true,
      remainingUses: 1,
      expiresAt: DateTime.now().minus({ day: 1 }),
    })

    const emptyInvite = await Invite.create({
      createdBy: user.id,
      label: 'Epuisee',
      isActive: true,
      remainingUses: 0,
    })

    const ok = await client.get(`/invites/${validInvite.code}/validate`)
    ok.assertStatus(200)
    assert.equal(ok.body().valid, true)

    const expired = await client.get(`/invites/${expiredInvite.code}/validate`)
    expired.assertStatus(200)
    assert.equal(expired.body().valid, false)

    const empty = await client.get(`/invites/${emptyInvite.code}/validate`)
    empty.assertStatus(200)
    assert.equal(empty.body().valid, false)
  })

  test('redeem cree compte local, referral et token', async ({ client, assert }) => {
    const { user: sponsor } = await makeUser('user', 'sponsor')

    const invite = await Invite.create({
      createdBy: sponsor.id,
      label: 'Join',
      isActive: true,
      remainingUses: 2,
      maxUses: 2,
    })

    const response = await client.post(`/invites/${invite.code}/redeem`).json({
      username: 'newbie',
      password: 'password123',
    })

    response.assertStatus(201)
    assert.exists(response.body().token?.value)

    const localUser = await User.findByOrFail('username', 'newbie')
    const referral = await Referral.findByOrFail('referred_user_id', localUser.id)
    assert.equal(referral.sponsorId, sponsor.id)

    const refreshedInvite = await Invite.findOrFail(invite.id)
    assert.equal(refreshedInvite.remainingUses, 1)
  })

  test('redeem applique restrictions bibliotheques et streams', async ({ client, assert }) => {
    const { user: sponsor } = await makeUser('user', 'restrictions')

    const calls: { libraries: string[]; maxStreams: number } = { libraries: [], maxStreams: 0 }

    fakeJellyfinAccountManager({
      setAllowedLibraries: async (_id, libraryIds) => {
        calls.libraries = libraryIds
      },
      setMaxStreams: async (_id, maxStreams) => {
        calls.maxStreams = maxStreams
      },
    })

    const invite = await Invite.create({
      createdBy: sponsor.id,
      isActive: true,
      remainingUses: 1,
      allowedLibraries: ['lib-1', 'lib-2'],
      maxStreams: 2,
    })

    const response = await client.post(`/invites/${invite.code}/redeem`).json({
      username: 'restricted-user',
      password: 'password123',
    })

    response.assertStatus(201)
    assert.deepEqual(calls.libraries, ['lib-1', 'lib-2'])
    assert.equal(calls.maxStreams, 2)
  })

  test('job d expiration desactive les comptes expires', async ({ assert }) => {
    const { user: sponsor } = await makeUser('user', 'job-sponsor')
    const { user: referred } = await makeUser('user', 'job-referred')

    const invite = await Invite.create({
      createdBy: sponsor.id,
      isActive: true,
      remainingUses: 1,
    })

    const disabledUsers: string[] = []
    fakeJellyfinAccountManager({
      disableUser: async (jellyfinUserId) => {
        disabledUsers.push(jellyfinUserId)
      },
    })

    const referral = await Referral.create({
      inviteId: invite.id,
      sponsorId: sponsor.id,
      referredUserId: referred.id,
      jellyfinUserId: 'jf-expired-1',
      accountExpiresAt: DateTime.now().minus({ hours: 2 }),
      status: 'active',
      notifiedExpiry: true,
    })

    const fakeManager = await app.container.make(JellyfinAccountManager)
    const job = new ExpiredAccountsJob(fakeManager)
    await job.run()

    const refreshed = await Referral.findOrFail(referral.id)
    assert.equal(refreshed.status, 'expired')
    assert.deepEqual(disabledUsers, ['jf-expired-1'])
  })

  test('admin revoke desactive le compte filleul', async ({ client, assert }) => {
    const { bearer: adminBearer } = await makeUser('admin', 'revoke-admin')
    const { user: sponsor } = await makeUser('user', 'revoke-sponsor')
    const { user: referred } = await makeUser('user', 'revoke-referred')

    const invite = await Invite.create({ createdBy: sponsor.id, isActive: true, remainingUses: 1 })

    let disabledUserId = ''
    fakeJellyfinAccountManager({
      disableUser: async (jellyfinUserId) => {
        disabledUserId = jellyfinUserId
      },
    })

    const referral = await Referral.create({
      inviteId: invite.id,
      sponsorId: sponsor.id,
      referredUserId: referred.id,
      jellyfinUserId: 'jf-revoke-1',
      status: 'active',
    })

    const response = await client
      .put(`/admin/referrals/${referral.id}/revoke`)
      .header('Authorization', `Bearer ${adminBearer}`)

    response.assertStatus(200)

    const refreshed = await Referral.findOrFail(referral.id)
    assert.equal(refreshed.status, 'revoked')
    assert.equal(disabledUserId, 'jf-revoke-1')
  })

  test('admin extend prolonge la date d expiration', async ({ client, assert }) => {
    const { bearer: adminBearer } = await makeUser('admin', 'extend-admin')
    const { user: sponsor } = await makeUser('user', 'extend-sponsor')
    const { user: referred } = await makeUser('user', 'extend-referred')

    const invite = await Invite.create({ createdBy: sponsor.id, isActive: true, remainingUses: 1 })

    const referral = await Referral.create({
      inviteId: invite.id,
      sponsorId: sponsor.id,
      referredUserId: referred.id,
      jellyfinUserId: 'jf-extend-1',
      accountExpiresAt: DateTime.now().plus({ days: 1 }),
      status: 'active',
    })

    const previous = referral.accountExpiresAt!

    const response = await client
      .put(`/admin/referrals/${referral.id}/extend`)
      .header('Authorization', `Bearer ${adminBearer}`)
      .json({ days: 7 })

    response.assertStatus(200)

    const refreshed = await Referral.findOrFail(referral.id)
    assert.isTrue(refreshed.accountExpiresAt!.toMillis() > previous.toMillis())
  })

  test('admin voit l arbre de parrainage', async ({ client, assert }) => {
    const { bearer: adminBearer } = await makeUser('admin', 'tree-admin')
    const { user: sponsor } = await makeUser('user', 'tree-sponsor')
    const { user: referred } = await makeUser('user', 'tree-referred')

    const invite = await Invite.create({ createdBy: sponsor.id, isActive: true, remainingUses: 1 })

    await Referral.create({
      inviteId: invite.id,
      sponsorId: sponsor.id,
      referredUserId: referred.id,
      jellyfinUserId: 'jf-tree-1',
      status: 'active',
    })

    const response = await client
      .get('/referrals/tree')
      .header('Authorization', `Bearer ${adminBearer}`)

    response.assertStatus(200)
    assert.isAtLeast(response.body().length, 1)
    assert.equal(response.body()[0].sponsor_id, sponsor.id)
    assert.equal(response.body()[0].referred_user_id, referred.id)
  })
})
