import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import WatchHistory from '#models/watch_history'

const searchValidator = vine.compile(
  vine.object({
    q: vine.string().trim().minLength(1),
    type: vine.enum(['movie', 'episode']).optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().optional(),
  })
)

/**
 * Escape SQL LIKE special characters for use with an explicit ESCAPE '\' clause.
 *
 * SQLite does not treat backslash as a LIKE escape character by default, so we
 * pair this function with a `whereRaw("... LIKE ? ESCAPE '\\'", [...])` call to
 * ensure `%` and `_` in user input are treated as literal characters.
 * Backslashes are escaped first so the added `\` prefixes are not re-escaped.
 */
function escapeLike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Clamp a numeric limit to the range [1, max].
 */
function clampLimit(value: number, max: number): number {
  return Math.max(1, Math.min(value, max))
}

/**
 * StreamyStats search controller.
 *
 * Provides a search interface over the local watch-history data collected by
 * StreamyStats-compatible webhooks.  Unlike the TMDB-backed `SearchController`,
 * this controller queries the database directly so that results reflect only
 * what the user has actually watched.
 *
 * Lives in `app/StreamyStats/controllers/` following the feature-based
 * architecture (Romain Lanz model) where each domain owns its own HTTP layer.
 */
export default class StreamyStatsSearchController {
  /**
   * GET /api/streamystats/search
   *
   * Search watch-history entries by title.  Results are scoped to the
   * authenticated user unless the caller has the `admin` role, in which case
   * all users' history is searched.
   */
  async search({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const { q, type, page = 1, limit: rawLimit = 20 } = await request.validateUsing(searchValidator)
    const limit = clampLimit(rawLimit, 100)

    const query = WatchHistory.query()
      .whereRaw("LOWER(title) LIKE LOWER(?) ESCAPE '\\'", [`%${escapeLike(q)}%`])
      .orderBy('watched_at', 'desc')

    if (type) {
      query.where('media_type', type)
    }

    if (user.role !== 'admin') {
      query.where('user_id', user.id)
    }

    const results = await query.paginate(page, limit)

    return {
      page: results.currentPage,
      total_pages: results.lastPage,
      total_results: results.total,
      results: results.all().map((item) => ({
        id: item.id,
        title: item.title,
        mediaType: item.mediaType,
        jellyfinItemId: item.jellyfinItemId,
        watchedAt: item.watchedAt,
        percentPlayed: item.percentPlayed,
        durationTicks: item.durationTicks,
        seriesName: item.seriesName,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
      })),
    }
  }

  /**
   * GET /api/streamystats/search/top
   *
   * Return the most-watched titles for the authenticated user (or globally for
   * admins) based on play count within the stored watch history.
   */
  async top({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const mediaType = request.input('type') as 'movie' | 'episode' | undefined
    const limitRaw = Number(request.input('limit') || 10)
    const limit = clampLimit(Number.isFinite(limitRaw) ? limitRaw : 10, 50)

    if (mediaType && !['movie', 'episode'].includes(mediaType)) {
      return response.badRequest({ message: 'Invalid type' })
    }

    const query = WatchHistory.query()
      .select('title', 'jellyfin_item_id', 'media_type')
      .count('* as play_count')
      .groupBy('jellyfin_item_id', 'title', 'media_type')
      .orderBy('play_count', 'desc')
      .limit(limit)

    if (mediaType) {
      query.where('media_type', mediaType)
    }

    if (user.role !== 'admin') {
      query.where('user_id', user.id)
    }

    const rows = await query

    return {
      results: rows.map((row) => ({
        title: row.title,
        jellyfinItemId: row.jellyfinItemId,
        mediaType: row.mediaType,
        playCount: Number((row as any).$extras.play_count),
      })),
    }
  }
}
