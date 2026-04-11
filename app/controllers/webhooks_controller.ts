import WatchHistory, { type WatchMediaType } from '#models/watch_history'
import WatchSession from '#models/watch_session'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import env from '#start/env'

interface JellyfinWebhookPayload {
  NotificationType?: string
  UserId?: string
  UserName?: string
  ItemId?: string
  ItemType?: string
  SeriesName?: string
  SeasonNumber?: number
  EpisodeNumber?: number
  Name?: string
  PlaybackPosition?: number
  RunTime?: number
  PlayedPercentage?: number
  DeviceName?: string
  ClientName?: string
  PlayMethod?: string
  SessionId?: string
}

const MIN_HISTORY_PERCENT = 5

function toMediaType(itemType?: string): WatchMediaType | null {
  if (!itemType) return null

  const normalized = itemType.toLowerCase()
  if (normalized === 'movie') return 'movie'
  if (normalized === 'episode') return 'episode'
  return null
}

function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const casted = Number(value)
  return Number.isFinite(casted) ? casted : fallback
}

function computePercentPlayed(payload: JellyfinWebhookPayload, playedTicks: number, durationTicks: number): number {
  if (typeof payload.PlayedPercentage === 'number' && Number.isFinite(payload.PlayedPercentage)) {
    return Math.max(0, Math.min(100, payload.PlayedPercentage))
  }

  if (durationTicks <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (playedTicks / durationTicks) * 100))
}

export default class WebhooksController {
  async jellyfin({ request, response }: HttpContext) {
    const secret = request.header('X-Webhook-Secret')
    if (secret !== env.get('JELLYFIN_WEBHOOK_SECRET')) {
      return response.unauthorized({ message: 'Invalid webhook secret' })
    }

    const payload = request.body() as JellyfinWebhookPayload

    try {
      const notificationType = payload.NotificationType
      if (!notificationType) {
        logger.debug({ payload }, 'Ignoring webhook payload without NotificationType')
        return { ok: true }
      }

      if (!payload.UserId || !payload.ItemId) {
        logger.debug({ payload }, 'Ignoring webhook payload missing UserId or ItemId')
        return { ok: true }
      }

      const user = await User.findBy('jellyfin_id', payload.UserId)
      if (!user) {
        logger.warn({ jellyfinUserId: payload.UserId, notificationType }, 'Ignoring webhook for unknown user')
        return { ok: true }
      }

      if (notificationType === 'PlaybackStart') {
        await this.handlePlaybackStart(user.id, payload)
      } else if (notificationType === 'PlaybackProgress') {
        await this.handlePlaybackProgress(user.id, payload)
      } else if (notificationType === 'PlaybackStop') {
        await this.handlePlaybackStop(user.id, payload)
      } else {
        logger.debug({ notificationType }, 'Ignoring unsupported webhook event type')
      }
    } catch (error) {
      logger.error({ error, payload }, 'Failed to process Jellyfin webhook event')
    }

    return { ok: true }
  }

  private async findActiveSession(userId: number, payload: JellyfinWebhookPayload): Promise<WatchSession | null> {
    const query = WatchSession.query()
      .where('user_id', userId)
      .where('jellyfin_item_id', payload.ItemId!)
      .whereNull('ended_at')
      .orderBy('started_at', 'desc')

    if (payload.SessionId) {
      query.where('jellyfin_session_id', payload.SessionId)
    }

    return query.first()
  }

  private async handlePlaybackStart(userId: number, payload: JellyfinWebhookPayload): Promise<void> {
    const activeSession = await this.findActiveSession(userId, payload)
    if (activeSession) {
      return
    }

    await WatchSession.create({
      userId,
      jellyfinItemId: payload.ItemId!,
      jellyfinSessionId: payload.SessionId || null,
      title: payload.Name || 'Unknown media',
      playMethod: payload.PlayMethod || 'Unknown',
      clientName: payload.ClientName || 'Unknown',
      deviceName: payload.DeviceName || 'Unknown',
      startedAt: DateTime.now(),
      pausedDurationTicks: 0,
    })
  }

  private async handlePlaybackProgress(userId: number, payload: JellyfinWebhookPayload): Promise<void> {
    const activeSession = await this.findActiveSession(userId, payload)
    if (!activeSession) {
      return
    }

    activeSession.playMethod = payload.PlayMethod || activeSession.playMethod
    activeSession.clientName = payload.ClientName || activeSession.clientName
    activeSession.deviceName = payload.DeviceName || activeSession.deviceName
    await activeSession.save()
  }

  private async handlePlaybackStop(userId: number, payload: JellyfinWebhookPayload): Promise<void> {
    const activeSession = await this.findActiveSession(userId, payload)
    if (!activeSession) {
      return
    }

    activeSession.endedAt = DateTime.now()
    activeSession.playMethod = payload.PlayMethod || activeSession.playMethod
    activeSession.clientName = payload.ClientName || activeSession.clientName
    activeSession.deviceName = payload.DeviceName || activeSession.deviceName
    await activeSession.save()

    const playedTicks = toNumber(payload.PlaybackPosition)
    const durationTicks = toNumber(payload.RunTime)
    const percentPlayed = computePercentPlayed(payload, playedTicks, durationTicks)

    if (percentPlayed < MIN_HISTORY_PERCENT) {
      return
    }

    const mediaType = toMediaType(payload.ItemType)
    if (!mediaType) {
      return
    }

    await WatchHistory.create({
      userId,
      jellyfinItemId: payload.ItemId!,
      mediaType,
      title: payload.Name || activeSession.title,
      seriesName: payload.SeriesName || null,
      seasonNumber: payload.SeasonNumber ?? null,
      episodeNumber: payload.EpisodeNumber ?? null,
      durationTicks,
      playedTicks,
      percentPlayed,
      watchedAt: DateTime.now(),
    })
  }
}
