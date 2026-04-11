import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import User from '#models/user'
import MediaRequest from '#models/media_request'
import ServiceInstance from '#models/service_instance'
import TmdbClient from '#services/tmdb_client'
import DownloadTracker from '#services/download_tracker'
import RadarrClient from '#services/radarr_client'
import SonarrClient from '#services/sonarr_client'

function fakeTmdbClient() {
  class FakeTmdbClient extends TmdbClient {
    async getMovie(tmdbId: number) {
      return {
        id: tmdbId,
        title: 'Inception',
      } as any
    }

    async getTvShow(tmdbId: number) {
      return {
        id: tmdbId,
        name: 'Breaking Bad',
      } as any
    }
  }

  app.container.swap(TmdbClient, () => new FakeTmdbClient())
}

function fakeDownloadTracker(overrides: {
  dispatch?: (request: MediaRequest) => Promise<void>
  checkStatus?: (request: MediaRequest) => Promise<any>
} = {}) {
  class FakeDownloadTracker extends DownloadTracker {
    async dispatch(request: MediaRequest) {
      if (overrides.dispatch) return overrides.dispatch(request)
      request.status = 'downloading'
      request.externalId = 1001
      await request.save()
    }

    async checkStatus(request: MediaRequest) {
      if (overrides.checkStatus) return overrides.checkStatus(request)
      return {
        status: request.status === 'available' ? 'completed' : 'downloading',
        progress: 45,
      }
    }

    async syncAll() {
      return
    }
  }

  app.container.swap(DownloadTracker, () => new FakeDownloadTracker())
}

function fakeRadarrClient() {
  class FakeRadarrClient extends RadarrClient {
    async getSystemStatus() {
      return { version: '4.0.0' }
    }

    async getQualityProfiles() {
      return [{ id: 1, name: 'HD-1080p' }]
    }

    async getRootFolders() {
      return [{ id: 1, path: '/movies' }]
    }

    async getQueue() {
      return [{ id: 1, movieId: 123, status: 'downloading' } as any]
    }
  }

  app.container.swap(RadarrClient, () => new FakeRadarrClient())
}

function fakeSonarrClient() {
  class FakeSonarrClient extends SonarrClient {
    async getSystemStatus() {
      return { version: '3.0.0' }
    }

    async getQualityProfiles() {
      return [{ id: 2, name: 'Any' }]
    }

    async getRootFolders() {
      return [{ id: 2, path: '/tv' }]
    }

    async getQueue() {
      return [{ id: 2, seriesId: 999, status: 'queued' } as any]
    }
  }

  app.container.swap(SonarrClient, () => new FakeSonarrClient())
}

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

test.group('Phase 3 - Media requests', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.each.setup(() => {
    fakeTmdbClient()
    fakeDownloadTracker()
    fakeRadarrClient()
    fakeSonarrClient()
  })

  group.each.teardown(() => {
    app.container.restore(TmdbClient)
    app.container.restore(DownloadTracker)
    app.container.restore(RadarrClient)
    app.container.restore(SonarrClient)
  })

  test('creates, lists, and fetches request details', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'crud')

    const createResponse = await client
      .post('/requests')
      .header('Authorization', `Bearer ${bearer}`)
      .json({ tmdb_id: 27205, media_type: 'movie' })

    createResponse.assertStatus(201)
    assert.equal(createResponse.body().title, 'Inception')
    assert.equal(createResponse.body().status, 'pending')

    const listResponse = await client.get('/requests').header('Authorization', `Bearer ${bearer}`)
    listResponse.assertStatus(200)
    assert.equal(listResponse.body().meta.total, 1)

    const requestId = createResponse.body().id
    const showResponse = await client
      .get(`/requests/${requestId}`)
      .header('Authorization', `Bearer ${bearer}`)

    showResponse.assertStatus(200)
    assert.equal(showResponse.body().id, requestId)
    assert.equal(showResponse.body().userId, user.id)
  })

  test('rejects duplicate request with 409', async ({ client }) => {
    const { user, bearer } = await makeUser('user', 'dup')

    await MediaRequest.create({
      userId: user.id,
      tmdbId: 27205,
      mediaType: 'movie',
      title: 'Inception',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const response = await client
      .post('/requests')
      .header('Authorization', `Bearer ${bearer}`)
      .json({ tmdb_id: 27205, media_type: 'movie' })

    response.assertStatus(409)
  })

  test('enforces permissions user vs admin', async ({ client }) => {
    const { user, bearer } = await makeUser('user', 'perm-owner')
    const { bearer: otherBearer } = await makeUser('user', 'perm-other')

    const req = await MediaRequest.create({
      userId: user.id,
      tmdbId: 100,
      mediaType: 'movie',
      title: 'Owner Movie',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const forbidden = await client
      .get(`/requests/${req.id}`)
      .header('Authorization', `Bearer ${otherBearer}`)

    forbidden.assertStatus(403)
  })

  test('approves request and dispatches in background', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'approve-user')
    const { bearer: adminBearer } = await makeUser('admin', 'approve-admin')

    await ServiceInstance.create({
      name: 'Radarr Main',
      type: 'radarr',
      url: 'http://radarr.local',
      apiKey: 'secret',
      rootFolder: '/movies',
      qualityProfileId: 1,
      isDefault: true,
      isActive: true,
    })

    const mediaRequest = await MediaRequest.create({
      userId: user.id,
      tmdbId: 27205,
      mediaType: 'movie',
      title: 'Inception',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    let dispatched = false
    fakeDownloadTracker({
      dispatch: async (request) => {
        dispatched = true
        request.status = 'downloading'
        request.externalId = 123
        await request.save()
      },
    })

    const response = await client
      .put(`/requests/${mediaRequest.id}`)
      .header('Authorization', `Bearer ${adminBearer}`)
      .json({ action: 'approve' })

    response.assertStatus(200)

    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.isTrue(dispatched)
  })

  test('declines request', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'decline-user')
    const { bearer: adminBearer } = await makeUser('admin', 'decline-admin')

    const mediaRequest = await MediaRequest.create({
      userId: user.id,
      tmdbId: 200,
      mediaType: 'tv',
      title: 'Breaking Bad',
      status: 'pending',
      requestedAt: DateTime.now(),
    })

    const response = await client
      .put(`/requests/${mediaRequest.id}`)
      .header('Authorization', `Bearer ${adminBearer}`)
      .json({ action: 'decline' })

    response.assertStatus(200)
    assert.equal(response.body().status, 'declined')
    assert.exists(response.body().respondedAt)
  })

  test('returns live download tracking status', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'download-status')

    const instance = await ServiceInstance.create({
      name: 'Radarr Status',
      type: 'radarr',
      url: 'http://radarr.local',
      apiKey: 'secret',
      rootFolder: '/movies',
      qualityProfileId: 1,
      isDefault: false,
      isActive: true,
    })

    const mediaRequest = await MediaRequest.create({
      userId: user.id,
      tmdbId: 10,
      mediaType: 'movie',
      title: 'Tracked Movie',
      status: 'downloading',
      requestedAt: DateTime.now(),
      serviceInstanceId: instance.id,
      externalId: 123,
    })

    fakeDownloadTracker({
      checkStatus: async () => ({
        status: 'downloading',
        progress: 72,
      }),
    })

    const response = await client
      .get(`/requests/${mediaRequest.id}/download`)
      .header('Authorization', `Bearer ${bearer}`)

    response.assertStatus(200)
    assert.equal(response.body().status, 'downloading')
    assert.equal(response.body().progress, 72)
  })

  test('manages service instances and tests connection (admin)', async ({ client, assert }) => {
    const { bearer: adminBearer } = await makeUser('admin', 'services')

    const createResponse = await client
      .post('/admin/services')
      .header('Authorization', `Bearer ${adminBearer}`)
      .json({
        name: 'Radarr 4K',
        type: 'radarr',
        url: 'http://radarr.local',
        api_key: 'super-secret',
        root_folder: '/movies-4k',
        quality_profile_id: 3,
        is_default: true,
      })

    createResponse.assertStatus(201)
    assert.notProperty(createResponse.body(), 'apiKey')

    const id = createResponse.body().id

    const testResponse = await client
      .get(`/admin/services/${id}/test`)
      .header('Authorization', `Bearer ${adminBearer}`)

    testResponse.assertStatus(200)
    assert.equal(testResponse.body().success, true)
    assert.equal(testResponse.body().version, '4.0.0')
  })
})
