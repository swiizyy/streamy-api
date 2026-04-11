import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import WatchHistory from '#models/watch_history'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'

const recommendationsValidator = vine.compile(
  vine.object({
    limit: vine.number().positive().optional(),
    type: vine.enum(['movie', 'episode', 'all'] as const).optional(),
  })
)

/**
 * Clamp a numeric limit to the range [1, max].
 */
function clampLimit(value: number, max: number): number {
  return Math.max(1, Math.min(value, max))
}

/**
 * StreamyStats recommendations controller.
 *
 * GET /api/recommendations
 *
 * Returns personalised recommendations derived from the authenticated
 * user's watch history. For each frequently-watched item we request
 * TMDB's built-in recommendations list, merge the results, deduplicate
 * them, and return the combined set.
 */
@inject()
export default class StreamyStatsRecommendationsController {
  constructor(private tmdb: TmdbClient) {}

  async index({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const { limit: rawLimit = 20, type } = await request.validateUsing(recommendationsValidator)
    const limit = clampLimit(rawLimit, 100)

    // 1. Find the most-played items for this user
    const mediaTypeFilter = type === 'movie' ? 'movie' : type === 'episode' ? 'episode' : undefined

    const topWatchedQuery = WatchHistory.query()
      .select('jellyfin_item_id', 'media_type', 'title')
      .count('* as play_count')
      .groupBy('jellyfin_item_id', 'media_type', 'title')
      .orderBy('play_count', 'desc')
      .where('user_id', user.id)
      .limit(10)

    if (mediaTypeFilter) {
      topWatchedQuery.where('media_type', mediaTypeFilter)
    }

    const topWatched = await topWatchedQuery

    // 2. Fetch TMDB recommendations for the top-watched items.
    //    We use a simple heuristic: if a watch-history title matches a TMDB
    //    multi-search result, we pull its TMDB recommendations.
    const recommendations: any[] = []
    const seenTmdbIds = new Set<number>()

    for (const item of topWatched) {
      try {
        const cacheKey = `streamystats:rec-search:${item.title}`
        let searchResult = cacheService.get<any>(cacheKey)

        if (!searchResult) {
          searchResult = await this.tmdb.searchMulti(item.title, 1)
          cacheService.set(cacheKey, searchResult, 3600)
        }

        const mediaTypeForSearch = item.mediaType === 'movie' ? 'movie' : 'tv'
        const match = searchResult.results.find((r: any) => r.media_type === mediaTypeForSearch)

        if (!match) continue

        const detailCacheKey = `streamystats:rec-details:${mediaTypeForSearch}:${match.id}`
        let details = cacheService.get<any>(detailCacheKey)

        if (!details) {
          if (mediaTypeForSearch === 'movie') {
            details = await this.tmdb.getMovie(match.id)
          } else {
            details = await this.tmdb.getTvShow(match.id)
          }
          cacheService.set(detailCacheKey, details, 3600)
        }

        const recs = details?.recommendations?.results ?? []

        for (const rec of recs) {
          if (seenTmdbIds.has(rec.id)) continue
          seenTmdbIds.add(rec.id)

          recommendations.push({
            id: rec.id,
            title: rec.title ?? rec.name ?? '',
            mediaType: rec.media_type ?? mediaTypeForSearch,
            overview: rec.overview ?? '',
            posterPath: rec.poster_path ?? null,
            backdropPath: rec.backdrop_path ?? null,
            voteAverage: rec.vote_average ?? 0,
            releaseDate: rec.release_date ?? rec.first_air_date ?? null,
            basedOn: item.title,
          })

          if (recommendations.length >= limit) break
        }
      } catch {
        // Skip items that fail TMDB lookup silently
      }

      if (recommendations.length >= limit) break
    }

    return {
      results: recommendations.slice(0, limit),
      total: recommendations.length,
    }
  }
}
