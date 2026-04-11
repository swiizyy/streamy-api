import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import type { TmdbMovie } from '#services/tmdb_types'

/**
 * Seerr-compatible movie details controller.
 *
 * GET /api/v1/movie/:movieId
 *
 * Returns TMDB movie details in the Seerr camelCase schema that clients
 * like Streamyfin expect.
 */
@inject()
export default class SeerrMovieController {
  constructor(private tmdb: TmdbClient) {}

  async show({ params, response }: HttpContext) {
    const movieId = parseInt(params.movieId, 10)

    if (Number.isNaN(movieId)) {
      return response.badRequest({ message: 'Invalid movie ID' })
    }

    const cacheKey = `seerr:movie:${movieId}`
    let movie = cacheService.get<TmdbMovie>(cacheKey)

    if (!movie) {
      try {
        movie = await this.tmdb.getMovie(movieId)
        cacheService.set(cacheKey, movie, 1800)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      id: movie.id,
      imdbId: movie.imdb_id,
      adult: movie.adult,
      backdropPath: movie.backdrop_path,
      posterPath: movie.poster_path,
      budget: movie.budget,
      genres: movie.genres,
      overview: movie.overview,
      popularity: movie.popularity,
      productionCompanies: (movie as any).production_companies?.map((c: any) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path ?? null,
        originCountry: c.origin_country,
      })),
      productionCountries: (movie as any).production_countries,
      releaseDate: movie.release_date,
      revenue: movie.revenue,
      runtime: movie.runtime,
      spokenLanguages: movie.spoken_languages?.map((l: any) => ({
        englishName: l.english_name ?? null,
        iso_639_1: l.iso_639_1,
        name: l.name,
      })),
      status: movie.status,
      tagline: movie.tagline,
      title: movie.title,
      originalTitle: movie.original_title,
      originalLanguage: movie.original_language,
      video: false,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      credits: movie.credits
        ? {
            cast: movie.credits.cast?.slice(0, 20).map((c) => ({
              id: c.id,
              castId: c.id,
              character: c.character,
              creditId: c.credit_id ?? '',
              gender: c.gender ?? 0,
              name: c.name,
              order: c.order ?? 0,
              profilePath: c.profile_path ?? null,
            })),
            crew: movie.credits.crew?.slice(0, 20).map((c) => ({
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
      relatedVideos: movie.videos?.results
        ?.filter((v) => ['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(v.type))
        .map((v) => ({
          url: `https://www.youtube.com/watch?v=${v.key}`,
          key: v.key,
          name: v.name,
          type: v.type,
          site: v.site,
        })),
    }
  }
}
