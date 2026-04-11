import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import type { TmdbSearchResult, TmdbSearchItem } from '#services/tmdb_types'

const searchValidator = vine.compile(
  vine.object({
    query: vine.string().trim().minLength(1),
    page: vine.number().positive().optional(),
    language: vine.string().optional(),
  })
)

/**
 * Transform a raw TMDB search item into the Seerr-compatible camelCase format.
 */
function transformItem(item: TmdbSearchItem): Record<string, unknown> {
  if (item.media_type === 'movie') {
    return {
      id: item.id,
      mediaType: 'movie',
      title: item.title ?? '',
      originalTitle: item.original_title,
      overview: item.overview,
      popularity: item.popularity,
      releaseDate: item.release_date,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
      genreIds: item.genre_ids,
      originalLanguage: item.original_language,
      adult: item.adult,
      video: false,
    }
  }

  if (item.media_type === 'tv') {
    return {
      id: item.id,
      mediaType: 'tv',
      name: item.name ?? '',
      originalName: item.original_name,
      overview: item.overview,
      popularity: item.popularity,
      firstAirDate: item.first_air_date,
      posterPath: item.poster_path,
      backdropPath: item.backdrop_path,
      voteAverage: item.vote_average,
      voteCount: item.vote_count,
      genreIds: item.genre_ids,
      originalLanguage: item.original_language,
      originCountry: [],
    }
  }

  // person
  return {
    id: item.id,
    mediaType: 'person',
    name: item.name ?? '',
    popularity: item.popularity,
    profilePath: item.profile_path ?? null,
    adult: item.adult,
    knownFor: (item.known_for ?? []).map((kf) => transformItem(kf)),
  }
}

/**
 * Seerr-compatible search controller.
 *
 * GET /api/v1/search?query=...&page=1
 *
 * Proxies to TMDB and returns results in the Seerr camelCase schema that
 * clients like Streamyfin expect.
 */
@inject()
export default class SeerrSearchController {
  constructor(private tmdb: TmdbClient) {}

  async search({ request, response }: HttpContext) {
    const { query, page = 1, language } = await request.validateUsing(searchValidator)
    const effectiveLanguage = language ?? 'fr-FR'

    const cacheKey = `seerr:search:${query}:${page}:${effectiveLanguage}`
    let result = cacheService.get<TmdbSearchResult>(cacheKey)

    if (!result) {
      try {
        result = await this.tmdb.searchMulti(query, page, effectiveLanguage)
        cacheService.set(cacheKey, result, 300)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
      results: result.results.map(transformItem),
    }
  }
}
