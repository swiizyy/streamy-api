import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import type { TmdbTvShow } from '#services/tmdb_types'

/**
 * Seerr-compatible TV show details controller.
 *
 * GET /api/v1/tv/:tvId
 *
 * Returns TMDB TV details in the Seerr camelCase schema that clients
 * like Streamyfin expect.
 */
@inject()
export default class SeerrTvController {
  constructor(private tmdb: TmdbClient) {}

  async show({ params, response }: HttpContext) {
    const tvId = parseInt(params.tvId, 10)

    if (Number.isNaN(tvId)) {
      return response.badRequest({ message: 'Invalid TV show ID' })
    }

    const cacheKey = `seerr:tv:${tvId}`
    let show = cacheService.get<TmdbTvShow>(cacheKey)

    if (!show) {
      try {
        show = await this.tmdb.getTvShow(tvId)
        cacheService.set(cacheKey, show, 1800)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      id: show.id,
      backdropPath: show.backdrop_path,
      posterPath: show.poster_path,
      firstAirDate: show.first_air_date,
      genres: show.genres,
      homepage: (show as any).homepage ?? null,
      inProduction: show.in_production,
      lastAirDate: show.last_air_date,
      name: show.name,
      networks: show.networks?.map((n) => ({
        id: n.id,
        name: n.name,
        logoPath: n.logo_path ?? null,
        originCountry: '',
      })),
      numberOfEpisodes: show.number_of_episodes,
      numberOfSeason: show.number_of_seasons,
      originCountry: (show as any).origin_country ?? [],
      originalLanguage: show.original_language,
      originalName: show.original_name,
      overview: show.overview,
      popularity: (show as any).popularity ?? 0,
      productionCompanies: (show as any).production_companies?.map((c: any) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path ?? null,
        originCountry: c.origin_country ?? '',
      })),
      productionCountries: (show as any).production_countries,
      spokenLanguages: show.spoken_languages?.map((l: any) => ({
        englishName: l.english_name ?? null,
        iso_639_1: l.iso_639_1,
        name: l.name,
      })),
      seasons: show.seasons?.map((s) => ({
        id: (s as any).id ?? 0,
        airDate: s.air_date ?? null,
        episodeCount: s.episode_count,
        name: s.name,
        overview: (s as any).overview ?? '',
        posterPath: s.poster_path ?? null,
        seasonNumber: s.season_number,
      })),
      status: show.status,
      tagline: (show as any).tagline ?? null,
      type: (show as any).type ?? null,
      voteAverage: show.vote_average,
      voteCount: show.vote_count,
      credits: show.credits
        ? {
            cast: show.credits.cast?.slice(0, 20).map((c) => ({
              id: c.id,
              castId: c.id,
              character: c.character,
              creditId: c.credit_id ?? '',
              gender: c.gender ?? 0,
              name: c.name,
              order: c.order ?? 0,
              profilePath: c.profile_path ?? null,
            })),
            crew: show.credits.crew?.slice(0, 20).map((c) => ({
              id: c.id,
              creditId: c.credit_id ?? '',
              gender: c.gender ?? 0,
              name: c.name,
              job: c.job,
              department: c.department,
              profilePath: c.profile_path ?? null,
            })),
          }
        : undefined,
    }
  }
}
