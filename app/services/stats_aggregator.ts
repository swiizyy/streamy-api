import WatchHistory from '#models/watch_history'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const TICKS_PER_SECOND = 10_000_000
const TICKS_PER_HOUR = TICKS_PER_SECOND * 3600
const TICKS_PER_MINUTE = TICKS_PER_SECOND * 60

export interface ActivityData {
  date: string
  total_duration_hours: number
  count: number
}

export interface HistoryFilters {
  userId?: number
  mediaType?: 'movie' | 'episode'
  from?: DateTime
  to?: DateTime
  page?: number
  limit?: number
}

export interface UserStats {
  total_watch_hours: number
  total_watch_minutes: number
  movies_watched: number
  episodes_watched: number
  top_genres: Array<{ name: string; count: number }>
  most_active_weekday: { weekday: string; count: number } | null
  most_active_hour: { hour: number; count: number } | null
  average_daily_watch_hours: number
  last_watched: Record<string, any> | null
}

export interface GlobalStats {
  active_users: number
  total_watch_hours: number
  top_media: Array<{ jellyfin_item_id: string; title: string; count: number }>
  top_users: Array<{ user_id: number; username: string; watch_hours: number; views: number }>
  play_method_distribution: Array<{ method: string; count: number }>
  client_distribution: Array<{ client: string; count: number }>
  peak_hours: Array<{ hour: number; count: number }>
}

function toHours(ticks: number): number {
  return Number((ticks / TICKS_PER_HOUR).toFixed(2))
}

function toMinutes(ticks: number): number {
  return Number((ticks / TICKS_PER_MINUTE).toFixed(2))
}

function weekdayFromIndex(index: number): string {
  // SQLite strftime('%w'): 0=Sunday, 1=Monday, ..., 6=Saturday
  const labels = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return labels[index] || 'unknown'
}

function applyDateRange<T extends any>(query: T, columnName: string, from?: DateTime, to?: DateTime): T {
  if (from) {
    // @ts-ignore
    query.where(columnName, '>=', from.toSQL())
  }

  if (to) {
    // @ts-ignore
    query.where(columnName, '<=', to.toSQL())
  }

  return query
}

export default class StatsAggregator {
  constructor(private tmdb: TmdbClient = new TmdbClient()) {}

  async getUserStats(userId: number, from?: DateTime, to?: DateTime): Promise<UserStats> {
    const totalsQuery = db.from('watch_histories').where('user_id', userId)
    applyDateRange(totalsQuery, 'watched_at', from, to)

    const totals = (await totalsQuery.sum({ playedTicks: 'played_ticks' }).count({ count: 'id' }).first()) || {
      playedTicks: 0,
      count: 0,
    }

    const [moviesRow, episodesRow] = await Promise.all([
      applyDateRange(
        db.from('watch_histories').where('user_id', userId).where('media_type', 'movie').where('percent_played', '>=', 90),
        'watched_at',
        from,
        to
      )
        .count({ count: 'id' })
        .first(),
      applyDateRange(
        db
          .from('watch_histories')
          .where('user_id', userId)
          .where('media_type', 'episode')
          .where('percent_played', '>=', 90),
        'watched_at',
        from,
        to
      )
        .count({ count: 'id' })
        .first(),
    ])

    const mostActiveWeekdayRow = await applyDateRange(
      db
        .from('watch_histories')
        .where('user_id', userId)
        .select(db.raw("CAST(strftime('%w', watched_at) as integer) as weekday_index"))
        .count({ count: 'id' })
        .groupBy('weekday_index')
        .orderBy('count', 'desc'),
      'watched_at',
      from,
      to
    ).first()

    const mostActiveHourRow = await applyDateRange(
      db
        .from('watch_histories')
        .where('user_id', userId)
        .select(db.raw("CAST(strftime('%H', watched_at) as integer) as hour"))
        .count({ count: 'id' })
        .groupBy('hour')
        .orderBy('count', 'desc'),
      'watched_at',
      from,
      to
    ).first()

    const dailyRows = await applyDateRange(
      db
        .from('watch_histories')
        .where('user_id', userId)
        .select(db.raw("date(watched_at) as watched_day"))
        .sum({ playedTicks: 'played_ticks' })
        .groupBy('watched_day'),
      'watched_at',
      from,
      to
    )

    const lastWatchedQuery = WatchHistory.query().where('user_id', userId).orderBy('watched_at', 'desc')
    if (from) lastWatchedQuery.where('watched_at', '>=', from.toSQL()!)
    if (to) lastWatchedQuery.where('watched_at', '<=', to.toSQL()!)
    const lastWatched = await lastWatchedQuery.first()

    const topGenres = await this.getTopGenres(userId, from, to)

    const totalPlayedTicks = Number(totals.playedTicks || 0)
    const totalDays = dailyRows.length || 1
    const totalDailyTicks = dailyRows.reduce((sum, row) => sum + Number(row.playedTicks || 0), 0)

    return {
      total_watch_hours: toHours(totalPlayedTicks),
      total_watch_minutes: toMinutes(totalPlayedTicks),
      movies_watched: Number(moviesRow?.count || 0),
      episodes_watched: Number(episodesRow?.count || 0),
      top_genres: topGenres,
      most_active_weekday: mostActiveWeekdayRow
        ? {
            weekday: weekdayFromIndex(Number(mostActiveWeekdayRow.weekday_index)),
            count: Number(mostActiveWeekdayRow.count || 0),
          }
        : null,
      most_active_hour: mostActiveHourRow
        ? {
            hour: Number(mostActiveHourRow.hour || 0),
            count: Number(mostActiveHourRow.count || 0),
          }
        : null,
      average_daily_watch_hours: toHours(totalDailyTicks / totalDays),
      last_watched: lastWatched?.serialize() || null,
    }
  }

  async getGlobalStats(from?: DateTime, to?: DateTime): Promise<GlobalStats> {
    const [activeUsersRow, totalTicksRow, topMediaRows, topUsersRows, methods, clients, peakHours] =
      await Promise.all([
        applyDateRange(db.from('watch_histories').countDistinct({ count: 'user_id' }), 'watched_at', from, to).first(),
        applyDateRange(db.from('watch_histories').sum({ playedTicks: 'played_ticks' }), 'watched_at', from, to).first(),
        applyDateRange(
          db
            .from('watch_histories')
            .select('jellyfin_item_id', 'title')
            .count({ count: 'id' })
            .groupBy('jellyfin_item_id', 'title')
            .orderBy('count', 'desc')
            .limit(10),
          'watched_at',
          from,
          to
        ),
        applyDateRange(
          db
            .from('watch_histories')
            .join('users', 'watch_histories.user_id', 'users.id')
            .select('watch_histories.user_id', 'users.username')
            .sum({ playedTicks: 'watch_histories.played_ticks' })
            .count({ views: 'watch_histories.id' })
            .groupBy('watch_histories.user_id', 'users.username')
            .orderBy('playedTicks', 'desc')
            .limit(5),
          'watch_histories.watched_at',
          from,
          to
        ),
        applyDateRange(
          db
            .from('watch_sessions')
            .select('play_method')
            .count({ count: 'id' })
            .groupBy('play_method')
            .orderBy('count', 'desc'),
          'started_at',
          from,
          to
        ),
        applyDateRange(
          db
            .from('watch_sessions')
            .select('client_name')
            .count({ count: 'id' })
            .groupBy('client_name')
            .orderBy('count', 'desc'),
          'started_at',
          from,
          to
        ),
        applyDateRange(
          db
            .from('watch_histories')
            .select(db.raw("CAST(strftime('%H', watched_at) as integer) as hour"))
            .count({ count: 'id' })
            .groupBy('hour')
            .orderBy('count', 'desc'),
          'watched_at',
          from,
          to
        ),
      ])

    return {
      active_users: Number(activeUsersRow?.count || 0),
      total_watch_hours: toHours(Number(totalTicksRow?.playedTicks || 0)),
      top_media: topMediaRows.map((row) => ({
        jellyfin_item_id: String(row.jellyfin_item_id),
        title: String(row.title),
        count: Number(row.count || 0),
      })),
      top_users: topUsersRows.map((row) => ({
        user_id: Number(row.user_id),
        username: String(row.username),
        watch_hours: toHours(Number(row.playedTicks || 0)),
        views: Number(row.views || 0),
      })),
      play_method_distribution: methods.map((row) => ({
        method: String(row.play_method),
        count: Number(row.count || 0),
      })),
      client_distribution: clients.map((row) => ({
        client: String(row.client_name),
        count: Number(row.count || 0),
      })),
      peak_hours: peakHours.map((row) => ({
        hour: Number(row.hour || 0),
        count: Number(row.count || 0),
      })),
    }
  }

  async getActivity(
    userId: number | undefined,
    groupBy: 'day' | 'week' | 'month',
    from?: DateTime,
    to?: DateTime
  ): Promise<ActivityData[]> {
    let bucketExpr: string
    if (groupBy === 'week') {
      bucketExpr = "strftime('%Y-%W', watched_at)"
    } else if (groupBy === 'month') {
      bucketExpr = "strftime('%Y-%m', watched_at)"
    } else {
      bucketExpr = 'date(watched_at)'
    }

    const query = db
      .from('watch_histories')
      .select(db.raw(`${bucketExpr} as bucket`))
      .sum({ playedTicks: 'played_ticks' })
      .count({ count: 'id' })
      .groupBy('bucket')
      .orderBy('bucket', 'asc')

    if (userId) {
      query.where('user_id', userId)
    }

    applyDateRange(query, 'watched_at', from, to)

    const rows = await query
    return rows.map((row) => ({
      date: String(row.bucket),
      total_duration_hours: toHours(Number(row.playedTicks || 0)),
      count: Number(row.count || 0),
    }))
  }

  async getHistory(filters: HistoryFilters) {
    const page = filters.page || 1
    const limit = Math.min(filters.limit || 20, 100)

    const query = WatchHistory.query().preload('user').orderBy('watched_at', 'desc')

    if (filters.userId) {
      query.where('user_id', filters.userId)
    }

    if (filters.mediaType) {
      query.where('media_type', filters.mediaType)
    }

    if (filters.from) {
      query.where('watched_at', '>=', filters.from.toSQL()!)
    }

    if (filters.to) {
      query.where('watched_at', '<=', filters.to.toSQL()!)
    }

    return query.paginate(page, limit)
  }

  private async getTopGenres(userId: number, from?: DateTime, to?: DateTime) {
    const topWatchedRows = await applyDateRange(
      db
        .from('watch_histories')
        .where('user_id', userId)
        .select('media_type', 'title', 'series_name')
        .count({ count: 'id' })
        .groupBy('media_type', 'title', 'series_name')
        .orderBy('count', 'desc')
        .limit(20),
      'watched_at',
      from,
      to
    )

    const genreCounts = new Map<string, number>()

    for (const row of topWatchedRows) {
      const mediaType = row.media_type === 'episode' ? 'tv' : 'movie'
      const lookupTitle = mediaType === 'tv' ? row.series_name || row.title : row.title
      const genres = await this.lookupGenreNames(mediaType, String(lookupTitle || ''))
      const weight = Number(row.count || 0)

      for (const genreName of genres) {
        genreCounts.set(genreName, (genreCounts.get(genreName) || 0) + weight)
      }
    }

    return [...genreCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  private async lookupGenreNames(mediaType: 'movie' | 'tv', title: string): Promise<string[]> {
    if (!title.trim()) {
      return []
    }

    const cacheKey = `stats:genres:${mediaType}:${title.toLowerCase()}`
    const cached = cacheService.get<string[]>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const [searchResult, genreList] = await Promise.all([
        mediaType === 'movie' ? this.tmdb.searchMovie(title, 1) : this.tmdb.searchTv(title, 1),
        this.tmdb.getGenres(mediaType),
      ])

      const genreMap = new Map(genreList.map((genre) => [genre.id, genre.name]))
      const firstResult = searchResult.results[0]
      const genreNames = (firstResult?.genre_ids || [])
        .map((id) => genreMap.get(id))
        .filter((name): name is string => Boolean(name))

      cacheService.set(cacheKey, genreNames, 21600)
      return genreNames
    } catch {
      cacheService.set(cacheKey, [], 3600)
      return []
    }
  }
}
