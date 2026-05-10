import env from '#start/env'
import User from '#models/user'
import WatchHistory from '#models/watch_history'
import WatchSession from '#models/watch_session'
import { buildJellyfinAuthHeader } from '#services/jellyfin_client'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'

interface JellyfinSession {
  Id: string
  UserId: string
  UserName: string
  NowPlayingItem?: {
    Id: string
    Name: string
    Type: string
    SeriesName?: string
  }
  PlayState?: {
    PositionTicks?: number
    CanSeek?: boolean
    IsPaused?: boolean
    PlayMethod?: string
  }
  Client?: string
  DeviceName?: string
  LastActivityDate?: string
}

interface JellyfinHistoryItem {
  Id: string
  Name: string
  Type: string
  SeriesName?: string
  UserData?: {
    PlayCount?: number
    LastPlayedDate?: string
    PlaybackPositionTicks?: number
    Played?: boolean
  }
  RunTimeTicks?: number
  IndexNumber?: number
  ParentIndexNumber?: number
}

export default class JellyfinStatsService {
  private baseUrl = env.get('JELLYFIN_URL').replace(/\/$/, '')
  private apiKey = env.get('JELLYFIN_API_KEY')

  private get headers() {
    return {
      'X-Emby-Token': this.apiKey,
      'X-Emby-Authorization': buildJellyfinAuthHeader(this.apiKey),
    }
  }

  async syncSessions(): Promise<void> {
    let sessions: JellyfinSession[]
    try {
      const res = await fetch(`${this.baseUrl}/Sessions`, { headers: this.headers })
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Failed to fetch Jellyfin sessions')
        return
      }
      sessions = (await res.json()) as JellyfinSession[]
    } catch (error) {
      logger.warn({ error }, 'Error syncing Jellyfin sessions')
      return
    }

    const users = await User.all()
    const userMap = new Map(users.map((u) => [u.jellyfinId, u]))

    for (const session of sessions) {
      if (!session.NowPlayingItem) continue

      const user = userMap.get(session.UserId)
      if (!user) continue

      try {
        await WatchSession.updateOrCreate(
          { jellyfinSessionId: session.Id },
          {
            userId: user.id,
            jellyfinItemId: session.NowPlayingItem.Id,
            jellyfinSessionId: session.Id,
            title: session.NowPlayingItem.Name,
            playMethod: session.PlayState?.PlayMethod ?? 'unknown',
            clientName: session.Client ?? 'unknown',
            deviceName: session.DeviceName ?? 'unknown',
            startedAt: DateTime.now(),
            pausedDurationTicks: 0,
          }
        )
      } catch (error) {
        logger.warn({ error, sessionId: session.Id }, 'Failed to upsert watch session')
      }
    }
  }

  async getUserHistory(userId: string): Promise<JellyfinHistoryItem[]> {
    const res = await fetch(
      `${this.baseUrl}/Users/${userId}/Items?Recursive=true&Filters=IsPlayed&Fields=UserData,RunTimeTicks,SeriesInfo,ParentIndexNumber,IndexNumber&Limit=500`,
      { headers: this.headers }
    )

    if (!res.ok) {
      throw new Error(`Jellyfin user history failed: ${res.status}`)
    }

    const data = (await res.json()) as { Items: JellyfinHistoryItem[] }
    return data.Items || []
  }

  async getTopItems(limit: number = 10): Promise<Array<{ jellyfinItemId: string; title: string; count: number }>> {
    const rows = await db
      .from('watch_histories')
      .select('jellyfin_item_id', 'title')
      .count({ count: 'id' })
      .groupBy('jellyfin_item_id', 'title')
      .orderBy('count', 'desc')
      .limit(limit)

    return rows.map((row) => ({
      jellyfinItemId: String(row.jellyfin_item_id),
      title: String(row.title),
      count: Number(row.count || 0),
    }))
  }

  async syncUserHistories(): Promise<void> {
    const users = await User.all()

    for (const user of users) {
      try {
        const items = await this.getUserHistory(user.jellyfinId)

        for (const item of items) {
          if (!item.UserData?.LastPlayedDate) continue

          const mediaType = item.Type === 'Movie' ? 'movie' : 'episode'
          const watchedAt = DateTime.fromISO(item.UserData.LastPlayedDate)
          const playedTicks = item.UserData.PlaybackPositionTicks ?? item.RunTimeTicks ?? 0
          const percentPlayed =
            item.RunTimeTicks && item.RunTimeTicks > 0
              ? Math.min(100, Math.round((playedTicks / item.RunTimeTicks) * 100))
              : item.UserData.Played
                ? 100
                : 0

          await WatchHistory.updateOrCreate(
            { userId: user.id, jellyfinItemId: item.Id, watchedAt },
            {
              userId: user.id,
              jellyfinItemId: item.Id,
              mediaType,
              title: item.Name,
              seriesName: item.SeriesName ?? null,
              watchedAt,
              durationTicks: item.RunTimeTicks ?? 0,
              playedTicks,
              percentPlayed,
              seasonNumber: item.ParentIndexNumber ?? null,
              episodeNumber: item.IndexNumber ?? null,
            }
          )
        }
      } catch (error) {
        logger.warn({ error, userId: user.id }, 'Failed to sync history for user')
      }
    }
  }
}
