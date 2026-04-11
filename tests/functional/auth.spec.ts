import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import JellyfinClient from '#services/jellyfin_client'
import type { JellyfinAuthResponse } from '#services/jellyfin_types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal JellyfinAuthResponse fixture */
function makeJellyfinAuthResponse(overrides: {
  id?: string
  name?: string
  isAdmin?: boolean
  token?: string
} = {}): JellyfinAuthResponse {
  return {
    User: {
      Id: overrides.id ?? 'jellyfin-user-id-001',
      Name: overrides.name ?? 'testuser',
      HasPassword: true,
      HasConfiguredPassword: true,
      Policy: {
        IsAdministrator: overrides.isAdmin ?? false,
        IsDisabled: false,
        EnableAllFolders: false,
      },
    },
    AccessToken: overrides.token ?? 'jf-token-abc123',
    ServerId: 'server-001',
  }
}

/** Registers a fake JellyfinClient that replaces the real one in the IoC container */
function fakeJellyfinClient(
  authenticateFn: (username: string, password: string) => Promise<JellyfinAuthResponse>
) {
  class FakeJellyfinClient extends JellyfinClient {
    async authenticate(username: string, password: string) {
      return authenticateFn(username, password)
    }
    async getUser() {
      return makeJellyfinAuthResponse().User
    }
    async isAdmin() {
      return false
    }
  }

  app.container.swap(JellyfinClient, () => new FakeJellyfinClient())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.group('Auth — POST /auth/login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => app.container.restore(JellyfinClient))

  test('returns 200 with user and token on valid credentials', async ({ client, assert }) => {
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))

    const response = await client.post('/auth/login').json({
      username: 'testuser',
      password: 'correct-password',
    })

    response.assertStatus(200)
    assert.exists(response.body().token?.value)
    assert.equal(response.body().user?.username, 'testuser')
    assert.equal(response.body().user?.role, 'user')
    assert.notProperty(response.body().user ?? {}, 'jellyfinToken')
  })

  test('assigns admin role when Jellyfin marks user as administrator', async ({
    client,
    assert,
  }) => {
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: true }))

    const response = await client.post('/auth/login').json({
      username: 'adminuser',
      password: 'correct-password',
    })

    response.assertStatus(200)
    assert.equal(response.body().user?.role, 'admin')
  })

  test('updates username and token on subsequent login without changing role', async ({
    client,
    assert,
  }) => {
    // First login creates user
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))
    await client.post('/auth/login').json({ username: 'testuser', password: 'pw' })

    // Manually change the role to 'requester'
    const existing = await User.findByOrFail('jellyfin_id', 'jellyfin-user-id-001')
    existing.role = 'requester'
    await existing.save()

    // Second login should NOT reset role
    fakeJellyfinClient(async () =>
      makeJellyfinAuthResponse({ name: 'testuser-renamed', token: 'new-jf-token' })
    )
    const response = await client.post('/auth/login').json({ username: 'testuser', password: 'pw' })

    response.assertStatus(200)
    assert.equal(response.body().user?.role, 'requester')
    assert.equal(response.body().user?.username, 'testuser-renamed')
  })

  test('returns 401 when Jellyfin rejects credentials', async ({ client }) => {
    fakeJellyfinClient(async () => {
      throw new Error('Invalid credentials')
    })

    const response = await client.post('/auth/login').json({
      username: 'baduser',
      password: 'wrong-password',
    })

    response.assertStatus(401)
  })

  test('returns 422 when request body is missing required fields', async ({ client }) => {
    const response = await client.post('/auth/login').json({})
    response.assertStatus(422)
  })
})

test.group('Auth — GET /auth/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns user profile with valid bearer token', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-me-001',
      username: 'meuser',
      jellyfinToken: 'jf-token',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    const response = await client
      .get('/auth/me')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.equal(response.body().username, 'meuser')
    assert.equal(response.body().role, 'user')
    assert.notProperty(response.body(), 'jellyfinToken')
  })

  test('returns 401 without a token', async ({ client }) => {
    const response = await client.get('/auth/me')
    response.assertStatus(401)
  })

  test('returns 401 with an invalid token', async ({ client }) => {
    const response = await client.get('/auth/me').header('Authorization', 'Bearer invalid-token')
    response.assertStatus(401)
  })
})

test.group('Auth — POST /auth/logout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('revokes the token and returns 204', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-logout-001',
      username: 'logoutuser',
      jellyfinToken: 'jf-token',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)
    const tokenValue = token.value!.release()

    const logoutResponse = await client
      .post('/auth/logout')
      .header('Authorization', `Bearer ${tokenValue}`)

    logoutResponse.assertStatus(204)

    // Token should now be invalid — /auth/me must return 401
    const meResponse = await client
      .get('/auth/me')
      .header('Authorization', `Bearer ${tokenValue}`)

    assert.equal(meResponse.status(), 401)
  })

  test('returns 401 when called without a token', async ({ client }) => {
    const response = await client.post('/auth/logout')
    response.assertStatus(401)
  })
})
