import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import WatchHistory from '#models/watch_history'
import WatchSession from '#models/watch_session'
import { DateTime } from 'luxon'

const WEBHOOK_SECRET = 'test-webhook-secret'

function makeWebhookPayload(overrides: Record<string, any> = {}) {
  return {
    NotificationType: 'PlaybackStart',
    UserId: 'jf-user-stats',
    UserName: 'stats-user',
    ItemId: 'item-1',
    ItemType: 'Movie',
    Name: 'Inception',
    PlaybackPosition: 0,
    RunTime: 1_000_000_000,
    PlayedPercentage: 0,
    DeviceName: 'iPhone',
    ClientName: 'Streamyfin',
    PlayMethod: 'DirectPlay',
    SessionId: 'session-1',
    ...overrides,
  }
}

async function makeUser(role: 'admin' | 'user', suffix: string, jellyfinId?: string) {
  const user = await User.create({
    jellyfinId: jellyfinId || `jf-${suffix}`,
    username: `${role}-${suffix}`,
    jellyfinToken: `token-${suffix}`,
    role,
  })

  const token = await User.accessTokens.create(user)
  return { user, bearer: token.value!.release() }
}

test.group('Phase 4 - Stats and webhooks', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('webhook PlaybackStart creates a watch session', async ({ client, assert }) => {
    await makeUser('user', 'start', 'jf-user-stats')

    const response = await client
      .post('/webhooks/jellyfin')
      .header('X-Webhook-Secret', WEBHOOK_SECRET)
      .json(makeWebhookPayload())

    response.assertStatus(200)

    const session = await WatchSession.query().where('jellyfin_item_id', 'item-1').first()
    assert.exists(session)
    assert.equal(session?.title, 'Inception')
    assert.equal(session?.endedAt, null)
  })

  test('webhook PlaybackStop closes session and creates history', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'stop', 'jf-user-stats')

    await WatchSession.create({
      userId: user.id,
      jellyfinItemId: 'item-stop',
      jellyfinSessionId: 'session-stop',
      title: 'Interstellar',
      playMethod: 'DirectPlay',
      clientName: 'Jellyfin Web',
      deviceName: 'Chrome',
      startedAt: DateTime.now().minus({ minutes: 10 }),
      pausedDurationTicks: 0,
    })

    const response = await client
      .post('/webhooks/jellyfin')
      .header('X-Webhook-Secret', WEBHOOK_SECRET)
      .json(
        makeWebhookPayload({
          NotificationType: 'PlaybackStop',
          ItemId: 'item-stop',
          SessionId: 'session-stop',
          Name: 'Interstellar',
          PlayedPercentage: 95,
          PlaybackPosition: 900_000_000,
          RunTime: 1_000_000_000,
        })
      )

    response.assertStatus(200)

    const closedSession = await WatchSession.query()
      .where('user_id', user.id)
      .where('jellyfin_item_id', 'item-stop')
      .firstOrFail()

    assert.exists(closedSession.endedAt)

    const history = await WatchHistory.query()
      .where('user_id', user.id)
      .where('jellyfin_item_id', 'item-stop')
      .first()

    assert.exists(history)
    assert.equal(history?.percentPlayed, 95)
  })

  test('webhook rejects invalid secret with 401', async ({ client }) => {
    const response = await client
      .post('/webhooks/jellyfin')
      .header('X-Webhook-Secret', 'invalid')
      .json(makeWebhookPayload())

    response.assertStatus(401)
  })

  test('webhook PlaybackStop with percent < 5 does not create history', async ({ client, assert }) => {
    const { user } = await makeUser('user', 'min-percent', 'jf-user-stats')

    await WatchSession.create({
      userId: user.id,
      jellyfinItemId: 'item-low',
      jellyfinSessionId: 'session-low',
      title: 'Short play',
      playMethod: 'DirectPlay',
      clientName: 'Jellyfin Web',
      deviceName: 'Chrome',
      startedAt: DateTime.now().minus({ minutes: 2 }),
      pausedDurationTicks: 0,
    })

    const response = await client
      .post('/webhooks/jellyfin')
      .header('X-Webhook-Secret', WEBHOOK_SECRET)
      .json(
        makeWebhookPayload({
          NotificationType: 'PlaybackStop',
          ItemId: 'item-low',
          SessionId: 'session-low',
          Name: 'Short play',
          PlayedPercentage: 4,
          PlaybackPosition: 40_000_000,
          RunTime: 1_000_000_000,
        })
      )

    response.assertStatus(200)

    const history = await WatchHistory.query().where('jellyfin_item_id', 'item-low').first()
    assert.isNull(history)
  })

  test('GET /stats/me returns aggregated user stats', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'stats-me')

    await WatchHistory.createMany([
      {
        userId: user.id,
        jellyfinItemId: 'm1',
        mediaType: 'movie',
        title: 'Movie One',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 3600,
        playedTicks: 10_000_000 * 3000,
        percentPlayed: 95,
        watchedAt: DateTime.now().minus({ days: 1 }),
      },
      {
        userId: user.id,
        jellyfinItemId: 'e1',
        mediaType: 'episode',
        title: 'Episode One',
        seriesName: 'Series One',
        seasonNumber: 1,
        episodeNumber: 1,
        durationTicks: 10_000_000 * 1800,
        playedTicks: 10_000_000 * 1600,
        percentPlayed: 91,
        watchedAt: DateTime.now(),
      },
    ])

    const response = await client.get('/stats/me').header('Authorization', `Bearer ${bearer}`)

    response.assertStatus(200)
    assert.property(response.body(), 'total_watch_hours')
    assert.equal(response.body().movies_watched, 1)
    assert.equal(response.body().episodes_watched, 1)
  })

  test('GET /stats/history supports pagination', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'history')

    await WatchHistory.createMany([
      {
        userId: user.id,
        jellyfinItemId: 'h1',
        mediaType: 'movie',
        title: 'H1',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 100,
        playedTicks: 10_000_000 * 100,
        percentPlayed: 100,
        watchedAt: DateTime.now().minus({ days: 3 }),
      },
      {
        userId: user.id,
        jellyfinItemId: 'h2',
        mediaType: 'movie',
        title: 'H2',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 100,
        playedTicks: 10_000_000 * 100,
        percentPlayed: 100,
        watchedAt: DateTime.now().minus({ days: 2 }),
      },
      {
        userId: user.id,
        jellyfinItemId: 'h3',
        mediaType: 'movie',
        title: 'H3',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 100,
        playedTicks: 10_000_000 * 100,
        percentPlayed: 100,
        watchedAt: DateTime.now().minus({ days: 1 }),
      },
    ])

    const response = await client
      .get('/stats/history?page=2&limit=2')
      .header('Authorization', `Bearer ${bearer}`)

    response.assertStatus(200)
    assert.equal(response.body().meta.perPage, 2)
    assert.equal(response.body().meta.currentPage, 2)
    assert.equal(response.body().data.length, 1)
  })

  test('GET /stats/activity returns day points', async ({ client, assert }) => {
    const { user, bearer } = await makeUser('user', 'activity')

    await WatchHistory.createMany([
      {
        userId: user.id,
        jellyfinItemId: 'a1',
        mediaType: 'movie',
        title: 'A1',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 120,
        playedTicks: 10_000_000 * 120,
        percentPlayed: 100,
        watchedAt: DateTime.fromISO('2026-01-01T10:00:00Z'),
      },
      {
        userId: user.id,
        jellyfinItemId: 'a2',
        mediaType: 'movie',
        title: 'A2',
        seriesName: null,
        seasonNumber: null,
        episodeNumber: null,
        durationTicks: 10_000_000 * 60,
        playedTicks: 10_000_000 * 60,
        percentPlayed: 100,
        watchedAt: DateTime.fromISO('2026-01-02T11:00:00Z'),
      },
    ])

    const response = await client
      .get('/stats/activity?group_by=day&from=2026-01-01')
      .header('Authorization', `Bearer ${bearer}`)

    response.assertStatus(200)
    assert.isArray(response.body())
    assert.isAtLeast(response.body().length, 2)
    assert.property(response.body()[0], 'date')
    assert.property(response.body()[0], 'total_duration_hours')
  })

  test('user cannot access another user stats', async ({ client }) => {
    const { user: owner } = await makeUser('user', 'owner')
    const { bearer: otherBearer } = await makeUser('user', 'other')

    const response = await client
      .get(`/stats/user/${owner.id}`)
      .header('Authorization', `Bearer ${otherBearer}`)

    response.assertStatus(403)
  })
})
