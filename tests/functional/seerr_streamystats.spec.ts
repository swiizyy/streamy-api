import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import User from '#models/user'
import MediaRequest from '#models/media_request'
import WatchHistory from '#models/watch_history'
import ServiceInstance from '#models/service_instance'
import JellyfinClient from '#services/jellyfin_client'
import TmdbClient from '#services/tmdb_client'
import NotificationService from '#services/notification_service'
import DownloadTracker from '#services/download_tracker'
import type { JellyfinAuthResponse } from '#services/jellyfin_types'
import type { TmdbSearchResult } from '#services/tmdb_types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal JellyfinAuthResponse fixture */
function makeJellyfinAuthResponse(
  overrides: {
    id?: string
    name?: string
    isAdmin?: boolean
    token?: string
  } = {}
): JellyfinAuthResponse {
  return {
    User: {
      Id: overrides.id ?? 'jf-seerr-001',
      Name: overrides.name ?? 'seerr-user',
      HasPassword: true,
      HasConfiguredPassword: true,
      Policy: {
        IsAdministrator: overrides.isAdmin ?? false,
        IsDisabled: false,
        EnableAllFolders: false,
      },
    },
    AccessToken: overrides.token ?? 'jf-token-seerr',
    ServerId: 'server-001',
  }
}

function fakeJellyfinClient(
  authenticateFn: (u: string, p: string) => Promise<JellyfinAuthResponse>
) {
  class Fake extends JellyfinClient {
    async authenticate(u: string, p: string) {
      return authenticateFn(u, p)
    }
  }
  app.container.swap(JellyfinClient, () => new Fake())
}

function fakeTmdbClient(searchResult?: Partial<TmdbSearchResult>) {
  class Fake extends TmdbClient {
    async searchMulti(): Promise<TmdbSearchResult> {
      return {
        page: 1,
        total_pages: 1,
        total_results: 2,
        results: [
          {
            id: 27205,
            media_type: 'movie',
            title: 'Inception',
            overview: '',
            poster_path: null,
            backdrop_path: null,
            vote_average: 8.8,
            vote_count: 1000,
            popularity: 50,
            genre_ids: [],
            original_language: 'en',
            adult: false,
          },
          {
            id: 1,
            media_type: 'person',
            name: 'Leonardo DiCaprio',
            overview: '',
            poster_path: null,
            profile_path: '/leo.jpg',
            backdrop_path: null,
            vote_average: 0,
            vote_count: 0,
            popularity: 90,
            genre_ids: [],
            original_language: 'en',
            adult: false,
          },
        ],
        ...searchResult,
      }
    }

    async getMovie(id: number) {
      return { id, title: 'Inception' } as any
    }

    async getTvShow(id: number) {
      return { id, name: 'Breaking Bad' } as any
    }
  }
  app.container.swap(TmdbClient, () => new Fake())
}

function fakeNotifications() {
  class Fake extends NotificationService {
    async notify() {}
    async notifyAdmins() {}
  }
  app.container.swap(NotificationService, () => new Fake())
}

function fakeDownloadTracker() {
  class Fake extends DownloadTracker {
    async dispatch() {}
    async checkStatus() {
      return { status: 'downloading', progress: 0 }
    }
  }
  app.container.swap(DownloadTracker, () => new Fake())
}

async function makeUser(
  role: 'admin' | 'user' | 'requester',
  suffix: string,
  jellyfinToken?: string
) {
  const user = await User.create({
    jellyfinId: `jf-seerr-${suffix}`,
    username: `seerr-${suffix}`,
    jellyfinToken: jellyfinToken ?? `tok-${suffix}`,
    role,
  })
  const token = await User.accessTokens.create(user)
  return { user, bearer: token.value!.release() }
}

// ---------------------------------------------------------------------------
// Seerr Auth
// ---------------------------------------------------------------------------

test.group('Seerr — POST /api/v1/auth/local', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => app.container.restore(JellyfinClient))

  test('returns Seerr-format user + token on valid credentials', async ({ client, assert }) => {
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))

    const res = await client
      .post('/api/v1/auth/local')
      .json({ username: 'seerr-user', password: 'pw' })

    res.assertStatus(200)
    assert.exists(res.body().token?.value)
    assert.equal(res.body().token?.type, 'Bearer')
    assert.equal(res.body().displayName, 'seerr-user')
    assert.typeOf(res.body().permissions, 'number')
    assert.equal(res.body().userType, 1)
  })

  test('returns 401 when Jellyfin rejects credentials', async ({ client }) => {
    fakeJellyfinClient(async () => {
      throw new Error('bad credentials')
    })

    const res = await client.post('/api/v1/auth/local').json({ username: 'bad', password: 'bad' })

    res.assertStatus(401)
  })

  test('promotes user to admin when Jellyfin marks them as administrator', async ({
    client,
    assert,
  }) => {
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: true }))

    const res = await client
      .post('/api/v1/auth/local')
      .json({ username: 'seerr-user', password: 'pw' })

    res.assertStatus(200)
    const created = await User.findByOrFail('jellyfinId', 'jf-seerr-001')
    assert.equal(created.role, 'admin')
  })

  test('preserves requester role on re-login (non-admin Jellyfin user)', async ({
    client,
    assert,
  }) => {
    // First login creates the user as 'user'
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))
    await client.post('/api/v1/auth/local').json({ username: 'seerr-user', password: 'pw' })

    // Manually demote to 'requester'
    const u = await User.findByOrFail('jellyfinId', 'jf-seerr-001')
    u.role = 'requester'
    await u.save()

    // Second login: Jellyfin still says non-admin — role must stay 'requester'
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))
    const res = await client
      .post('/api/v1/auth/local')
      .json({ username: 'seerr-user', password: 'pw' })

    res.assertStatus(200)
    const after = await User.findByOrFail('jellyfinId', 'jf-seerr-001')
    assert.equal(after.role, 'requester')
  })

  test('demotes from admin when Jellyfin admin flag is removed', async ({ client, assert }) => {
    // First login as admin
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: true }))
    await client.post('/api/v1/auth/local').json({ username: 'seerr-user', password: 'pw' })

    // Jellyfin now says non-admin
    fakeJellyfinClient(async () => makeJellyfinAuthResponse({ isAdmin: false }))
    await client.post('/api/v1/auth/local').json({ username: 'seerr-user', password: 'pw' })

    const u = await User.findByOrFail('jellyfinId', 'jf-seerr-001')
    assert.equal(u.role, 'user')
  })

  test('returns 422 when body is missing required fields', async ({ client }) => {
    const res = await client.post('/api/v1/auth/local').json({})
    res.assertStatus(422)
  })
})

test.group('Seerr — GET /api/v1/auth/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns Seerr user via OAT Bearer token', async ({ client, assert }) => {
    const { bearer } = await makeUser('user', 'me-oat')

    const res = await client.get('/api/v1/auth/me').header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.equal(res.body().displayName, 'seerr-me-oat')
    assert.typeOf(res.body().permissions, 'number')
    assert.equal(res.body().userType, 1)
  })

  test('returns Seerr user via MediaBrowser token header', async ({ client, assert }) => {
    await makeUser('user', 'me-mb', 'mb-tok-123')

    const res = await client
      .get('/api/v1/auth/me')
      .header('Authorization', 'MediaBrowser Token="mb-tok-123", Client="Streamyfin"')

    res.assertStatus(200)
    assert.equal(res.body().displayName, 'seerr-me-mb')
  })

  test('returns Seerr user via X-Emby-Token header', async ({ client, assert }) => {
    await makeUser('user', 'me-emby', 'emby-tok-456')

    const res = await client.get('/api/v1/auth/me').header('X-Emby-Token', 'emby-tok-456')

    res.assertStatus(200)
    assert.equal(res.body().displayName, 'seerr-me-emby')
  })

  test('returns 401 without credentials', async ({ client }) => {
    const res = await client.get('/api/v1/auth/me')
    res.assertStatus(401)
  })

  test('returns 401 for an invalid MediaBrowser token', async ({ client }) => {
    const res = await client
      .get('/api/v1/auth/me')
      .header('Authorization', 'MediaBrowser Token="no-such-token"')

    res.assertStatus(401)
  })
})

// ---------------------------------------------------------------------------
// Seerr Requests
// ---------------------------------------------------------------------------

test.group('Seerr — GET /api/v1/request', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    fakeTmdbClient()
    fakeNotifications()
    fakeDownloadTracker()
  })
  group.each.teardown(() => {
    app.container.restore(TmdbClient)
    app.container.restore(NotificationService)
    app.container.restore(DownloadTracker)
  })

  test('returns paginated list with numeric statuses', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'req-list')

    await MediaRequest.create({
      userId: user.id,
      tmdbId: 100,
      mediaType: 'movie',
      title: 'Test Movie',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const res = await client.get('/api/v1/request').header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.equal(res.body().pageInfo?.results, 1)
    assert.equal(res.body().results?.[0]?.status, 1) // 1 = PENDING
    assert.equal(res.body().results?.[0]?.is4k, false)
  })

  test('filters by filter=declined', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('admin', 'req-filter')

    await MediaRequest.createMany([
      {
        userId: user.id,
        tmdbId: 1,
        mediaType: 'movie',
        title: 'A',
        status: 'pending',
        requestedAt: DateTime.now(),
      },
      {
        userId: user.id,
        tmdbId: 2,
        mediaType: 'movie',
        title: 'B',
        status: 'declined',
        requestedAt: DateTime.now(),
      },
    ])

    const res = await client
      .get('/api/v1/request?filter=declined')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.equal(res.body().pageInfo?.results, 1)
    assert.equal(res.body().results?.[0]?.status, 3) // 3 = DECLINED
  })

  test('clamps take to 100', async ({ client, assert }) => {
    const { bearer } = await makeUser('admin', 'req-clamp')

    const res = await client
      .get('/api/v1/request?take=9999')
      .header('Authorization', `Bearer ${bearer}`)

    // Should not fail — clamped internally
    res.assertStatus(200)
    assert.exists(res.body().pageInfo)
  })

  test('rejects unavailable as filter value (removed from validator)', async ({ client }) => {
    const { bearer } = await makeUser('user', 'req-bad-filter')

    const res = await client
      .get('/api/v1/request?filter=unavailable')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(422)
  })
})

test.group('Seerr — POST /api/v1/request', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    fakeTmdbClient()
    fakeNotifications()
    fakeDownloadTracker()
  })
  group.each.teardown(() => {
    app.container.restore(TmdbClient)
    app.container.restore(NotificationService)
    app.container.restore(DownloadTracker)
  })

  test('creates a request and returns Seerr format', async ({ client, assert }) => {
    const { bearer } = await makeUser('user', 'req-create')

    const res = await client
      .post('/api/v1/request')
      .header('Authorization', `Bearer ${bearer}`)
      .json({ mediaType: 'movie', mediaId: 27205 })

    res.assertStatus(201)
    assert.equal(res.body().status, 1) // 1 = PENDING
    assert.equal(res.body().media?.title, 'Inception')
    assert.equal(res.body().is4k, false)
  })

  test('rejects duplicate request with 409', async ({ client }) => {
    const { user, bearer } = await makeUser('user', 'req-dup')

    await MediaRequest.create({
      userId: user.id,
      tmdbId: 27205,
      mediaType: 'movie',
      title: 'Inception',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const res = await client
      .post('/api/v1/request')
      .header('Authorization', `Bearer ${bearer}`)
      .json({ mediaType: 'movie', mediaId: 27205 })

    res.assertStatus(409)
  })
})

test.group('Seerr — POST /api/v1/request/:requestId/approve|decline', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    fakeNotifications()
    fakeDownloadTracker()
  })
  group.each.teardown(() => {
    app.container.restore(NotificationService)
    app.container.restore(DownloadTracker)
  })

  test('admin can approve a pending request', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'approve-owner')
    const { bearer: adminBearer } = await makeUser('admin', 'approve-admin')

    await ServiceInstance.create({
      name: 'Radarr',
      type: 'radarr',
      url: 'http://radarr.local',
      apiKey: 'secret',
      rootFolder: '/movies',
      qualityProfileId: 1,
      isDefault: true,
      isActive: true,
    })

    const req = await MediaRequest.create({
      userId: user.id,
      tmdbId: 1,
      mediaType: 'movie',
      title: 'Film',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const res = await client
      .post(`/api/v1/request/${req.id}/approve`)
      .header('Authorization', `Bearer ${adminBearer}`)

    res.assertStatus(200)
    assert.equal(res.body().status, 2) // 2 = APPROVED
  })

  test('admin can decline a pending request', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'decline-owner')
    const { bearer: adminBearer } = await makeUser('admin', 'decline-admin')

    const req = await MediaRequest.create({
      userId: user.id,
      tmdbId: 2,
      mediaType: 'movie',
      title: 'Film B',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const res = await client
      .post(`/api/v1/request/${req.id}/decline`)
      .header('Authorization', `Bearer ${adminBearer}`)

    res.assertStatus(200)
    assert.equal(res.body().status, 3) // 3 = DECLINED
  })

  test('non-admin cannot approve/decline', async ({ client }) => {
    const { user, bearer } = await makeUser('user', 'no-approve')

    const req = await MediaRequest.create({
      userId: user.id,
      tmdbId: 3,
      mediaType: 'movie',
      title: 'Film C',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const res = await client
      .post(`/api/v1/request/${req.id}/approve`)
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(403)
  })
})

// ---------------------------------------------------------------------------
// Seerr Search
// ---------------------------------------------------------------------------

test.group('Seerr — GET /api/v1/search', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => fakeTmdbClient())
  group.each.teardown(() => app.container.restore(TmdbClient))

  test('returns Seerr-format results including person with profilePath', async ({
    client,
    assert,
  }) => {
    const { bearer } = await makeUser('user', 'search')

    const res = await client
      .get('/api/v1/search?query=Inception')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.equal(res.body().totalResults, 2)

    const movie = res.body().results.find((r: any) => r.mediaType === 'movie')
    assert.equal(movie?.title, 'Inception')
    assert.notProperty(movie ?? {}, 'profilePath')

    const person = res.body().results.find((r: any) => r.mediaType === 'person')
    assert.equal(person?.name, 'Leonardo DiCaprio')
    // profilePath must come from profile_path, not poster_path
    assert.equal(person?.profilePath, '/leo.jpg')
    assert.notProperty(person ?? {}, 'posterPath')
  })

  test('returns 401 without credentials', async ({ client }) => {
    const res = await client.get('/api/v1/search?query=test')
    res.assertStatus(401)
  })
})

// ---------------------------------------------------------------------------
// StreamyStats Search
// ---------------------------------------------------------------------------

test.group('StreamyStats — GET /api/streamystats/search', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns matching watch-history entries for authenticated user', async ({
    client,
    assert,
  }) => {
    const { user, bearer } = await makeUser('user', 'ss-search')

    await WatchHistory.create({
      userId: user.id,
      jellyfinItemId: 'item-1',
      mediaType: 'movie',
      title: 'Inception',
      durationTicks: 1_000_000,
      playedTicks: 500_000,
      percentPlayed: 50,
      watchedAt: DateTime.now(),
    })

    await WatchHistory.create({
      userId: user.id,
      jellyfinItemId: 'item-2',
      mediaType: 'movie',
      title: 'Interstellar',
      durationTicks: 1_000_000,
      playedTicks: 1_000_000,
      percentPlayed: 100,
      watchedAt: DateTime.now(),
    })

    const res = await client
      .get('/api/streamystats/search?q=ince')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.equal(res.body().total_results, 1)
    assert.equal(res.body().results?.[0]?.title, 'Inception')
  })

  test('returns 401 without credentials', async ({ client }) => {
    const res = await client.get('/api/streamystats/search?q=test')
    res.assertStatus(401)
  })

  test('returns 422 when q is missing', async ({ client }) => {
    const { bearer } = await makeUser('user', 'ss-no-q')
    const res = await client
      .get('/api/streamystats/search')
      .header('Authorization', `Bearer ${bearer}`)
    res.assertStatus(422)
  })

  test('admin sees all users results', async ({ client, assert }) => {
    const { user: regularUser } = await makeUser('user', 'ss-admin-reg')
    const { bearer: adminBearer } = await makeUser('admin', 'ss-admin')

    await WatchHistory.create({
      userId: regularUser.id,
      jellyfinItemId: 'item-admin-1',
      mediaType: 'movie',
      title: 'Parasite',
      durationTicks: 1_000_000,
      playedTicks: 1_000_000,
      percentPlayed: 100,
      watchedAt: DateTime.now(),
    })

    const res = await client
      .get('/api/streamystats/search?q=Parasite')
      .header('Authorization', `Bearer ${adminBearer}`)

    res.assertStatus(200)
    assert.equal(res.body().total_results, 1)
  })

  test('scopes results to authenticated user when not admin', async ({ client, assert }) => {
    const { user: u1 } = await makeUser('user', 'ss-scope-1')
    const { bearer: bearerU2 } = await makeUser('user', 'ss-scope-2')

    await WatchHistory.create({
      userId: u1.id,
      jellyfinItemId: 'item-scope-1',
      mediaType: 'movie',
      title: 'Scoped Movie',
      durationTicks: 1_000_000,
      playedTicks: 1_000_000,
      percentPlayed: 100,
      watchedAt: DateTime.now(),
    })

    const res = await client
      .get('/api/streamystats/search?q=Scoped')
      .header('Authorization', `Bearer ${bearerU2}`)

    res.assertStatus(200)
    // u2 has no watch history — should see no results
    assert.equal(res.body().total_results, 0)
  })
})

test.group('StreamyStats — GET /api/streamystats/search/top', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('returns top-watched items for authenticated user', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'ss-top')

    for (let i = 0; i < 3; i++) {
      await WatchHistory.create({
        userId: user.id,
        jellyfinItemId: 'top-item-1',
        mediaType: 'movie',
        title: 'Top Movie',
        durationTicks: 1_000_000,
        playedTicks: 1_000_000,
        percentPlayed: 100,
        watchedAt: DateTime.now(),
      })
    }

    await WatchHistory.create({
      userId: user.id,
      jellyfinItemId: 'top-item-2',
      mediaType: 'movie',
      title: 'Other Movie',
      durationTicks: 1_000_000,
      playedTicks: 1_000_000,
      percentPlayed: 100,
      watchedAt: DateTime.now(),
    })

    const res = await client
      .get('/api/streamystats/search/top')
      .header('Authorization', `Bearer ${bearer}`)

    res.assertStatus(200)
    assert.isArray(res.body().results)
    assert.equal(res.body().results[0]?.title, 'Top Movie')
    assert.equal(res.body().results[0]?.playCount, 3)
  })

  test('returns 401 without credentials', async ({ client }) => {
    const res = await client.get('/api/streamystats/search/top')
    res.assertStatus(401)
  })
})
