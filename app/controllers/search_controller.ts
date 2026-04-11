import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import JellyfinClient from '#services/jellyfin_client'
import JellyfinSync from '#services/jellyfin_sync'
import type { TmdbSearchResult, TmdbMovie, TmdbTvShow, TmdbSeason } from '#services/tmdb_types'

/**
 * Pipe full TMDB image URLs
 */
function toImageUrl(path: string | null): string | null {
  if (!path) return null
  return `https://image.tmdb.org/t/p/w500${path}`
}

/**
 * Transform search result with Jellyfin availability
 */
function transformSearchResult(item: any, jellyfinStatus: { available: boolean; itemId?: string } | undefined) {
  return {
    tmdb_id: item.id ?? item.tmdbId,
    title: item.title ?? item.name,
    media_type: item.media_type ?? item.mediaType,
    overview: item.overview,
    poster_path: toImageUrl(item.poster_path),
    backdrop_path: toImageUrl(item.backdrop_path),
    vote_average: item.vote_average,
    release_date: item.release_date ?? item.first_air_date,
    genre_ids: item.genre_ids,
    jellyfin: {
      available: jellyfinStatus?.available ?? false,
      item_id: jellyfinStatus?.itemId,
    },
  }
}

// Validators
const searchValidator = vine.compile(
  vine.object({
    q: vine.string().trim().minLength(1),
    type: vine.enum(['movie', 'tv', 'multi']).optional(),
    page: vine.number().positive().optional(),
  })
)

const trendingValidator = vine.compile(
  vine.object({
    type: vine.enum(['movie', 'tv', 'all']).optional(),
    window: vine.enum(['day', 'week']).optional(),
  })
)

const discoverValidator = vine.compile(
  vine.object({
    type: vine.enum(['movie', 'tv']),
    genre: vine.number().optional(),
    year: vine.number().optional(),
    rating: vine.number().optional(),
    sort: vine.string().optional(),
    page: vine.number().positive().optional(),
  })
)

const genresValidator = vine.compile(
  vine.object({
    type: vine.enum(['movie', 'tv']),
  })
)

@inject()
export default class SearchController {
  constructor(
    private tmdb: TmdbClient,
    private jellyfin: JellyfinClient
  ) {}

  /**
   * GET /search
   */
  async search({ request, response, auth }: HttpContext) {
    const { q, type = 'multi', page = 1 } = await request.validateUsing(searchValidator)
    const user = auth.user!

    const cacheKey = `search:${type}:${q}:${page}`
    let searchResult = cacheService.get<TmdbSearchResult>(cacheKey)

    if (!searchResult) {
      try {
        if (type === 'movie') {
          searchResult = await this.tmdb.searchMovie(q, page)
        } else if (type === 'tv') {
          searchResult = await this.tmdb.searchTv(q, page)
        } else {
          searchResult = await this.tmdb.searchMulti(q, page)
        }
        cacheService.set(cacheKey, searchResult, 300)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const jellyfinSync = new JellyfinSync(this.jellyfin, user.jellyfinToken, user.jellyfinId)
    const items = searchResult.results.filter((item) => item.media_type !== 'person') as any[]
    const batchItems = items.map((item) => ({
      tmdbId: item.id,
      mediaType: item.media_type as 'movie' | 'tv',
    }))

    const availabilityMap = await jellyfinSync.checkBatchAvailability(batchItems)

    const enrichedResults = items.map((item) => {
      const key = `${item.media_type}:${item.id}`
      const availability = availabilityMap.get(key)
      return transformSearchResult(item, {
        available: availability?.available ?? false,
        itemId: availability?.jellyfinItemId,
      })
    })

    return {
      page: searchResult.page,
      total_pages: searchResult.total_pages,
      total_results: searchResult.total_results,
      results: enrichedResults,
    }
  }

  /**
   * GET /movies/:tmdbId
   */
  async movie({ params, response, auth }: HttpContext) {
    const tmdbId = parseInt(params.tmdbId)
    const user = auth.user!

    const cacheKey = `movie:${tmdbId}`
    let movie = cacheService.get<TmdbMovie>(cacheKey)

    if (!movie) {
      try {
        movie = await this.tmdb.getMovie(tmdbId)
        cacheService.set(cacheKey, movie, 1800)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const jellyfinSync = new JellyfinSync(this.jellyfin, user.jellyfinToken, user.jellyfinId)
    const availability = await jellyfinSync.checkAvailability(tmdbId, 'movie')

    return {
      tmdb_id: movie.id,
      title: movie.title,
      original_title: movie.original_title,
      overview: movie.overview,
      release_date: movie.release_date,
      runtime: movie.runtime,
      status: movie.status,
      tagline: movie.tagline,
      poster_path: toImageUrl(movie.poster_path),
      backdrop_path: toImageUrl(movie.backdrop_path),
      budget: movie.budget,
      revenue: movie.revenue,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genres: movie.genres,
      production_countries: movie.production_countries,
      spoken_languages: movie.spoken_languages,
      original_language: movie.original_language,
      cast: movie.credits?.cast?.slice(0, 20).map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profile_path: toImageUrl(person.profile_path),
      })),
      trailers: movie.videos?.results
        ?.filter((v) => v.type === 'Trailer')
        .map((v) => ({
          key: v.key,
          name: v.name,
          site: v.site,
        })),
      jellyfin: {
        available: availability.available,
        item_id: availability.jellyfinItemId,
        added_at: availability.addedAt,
      },
    }
  }

  /**
   * GET /tv/:tmdbId
   */
  async tvShow({ params, response, auth }: HttpContext) {
    const tmdbId = parseInt(params.tmdbId)
    const user = auth.user!

    const cacheKey = `tv:${tmdbId}`
    let show = cacheService.get<TmdbTvShow>(cacheKey)

    if (!show) {
      try {
        show = await this.tmdb.getTvShow(tmdbId)
        cacheService.set(cacheKey, show, 1800)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const jellyfinSync = new JellyfinSync(this.jellyfin, user.jellyfinToken, user.jellyfinId)
    const availability = await jellyfinSync.checkAvailability(tmdbId, 'tv')

    return {
      tmdb_id: show.id,
      name: show.name,
      original_name: show.original_name,
      overview: show.overview,
      first_air_date: show.first_air_date,
      last_air_date: show.last_air_date,
      status: show.status,
      number_of_seasons: show.number_of_seasons,
      number_of_episodes: show.number_of_episodes,
      episode_run_time: show.episode_run_time,
      poster_path: toImageUrl(show.poster_path),
      backdrop_path: toImageUrl(show.backdrop_path),
      in_production: show.in_production,
      vote_average: show.vote_average,
      vote_count: show.vote_count,
      genres: show.genres,
      production_countries: show.production_countries,
      spoken_languages: show.spoken_languages,
      original_language: show.original_language,
      networks: show.networks.map((n) => ({
        id: n.id,
        name: n.name,
        logo_path: toImageUrl(n.logo_path),
      })),
      seasons: show.seasons?.map((s) => ({
        season_number: s.season_number,
        name: s.name,
        episode_count: s.episode_count,
        poster_path: toImageUrl(s.poster_path),
        air_date: s.air_date,
      })),
      cast: show.credits?.cast?.slice(0, 20).map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profile_path: toImageUrl(person.profile_path),
      })),
      jellyfin: {
        available: availability.available,
        item_id: availability.jellyfinItemId,
        added_at: availability.addedAt,
      },
    }
  }

  /**
   * GET /tv/:tmdbId/season/:seasonNumber
   */
  async tvSeason({ params, response }: HttpContext) {
    const tmdbId = parseInt(params.tmdbId)
    const seasonNumber = parseInt(params.seasonNumber)

    const cacheKey = `tv:${tmdbId}:season:${seasonNumber}`
    let season = cacheService.get<TmdbSeason>(cacheKey)

    if (!season) {
      try {
        season = await this.tmdb.getTvSeason(tmdbId, seasonNumber)
        cacheService.set(cacheKey, season, 3600)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      id: season.id,
      season_number: season.season_number,
      name: season.name,
      overview: season.overview,
      air_date: season.air_date,
      vote_average: season.vote_average,
      poster_path: toImageUrl(season.poster_path),
      episodes: season.episodes.map((ep) => ({
        episode_number: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        air_date: ep.air_date,
        runtime: ep.runtime,
        still_path: toImageUrl(ep.still_path),
        vote_average: ep.vote_average,
        crew: ep.crew?.map((c) => ({
          id: c.id,
          name: c.name,
          job: c.job,
          department: c.department,
        })),
      })),
    }
  }

  /**
   * GET /trending
   */
  async trending({ request, response, auth }: HttpContext) {
    const { type = 'all', window = 'week' } = await request.validateUsing(trendingValidator)
    const user = auth.user!

    const cacheKey = `trending:${type}:${window}`
    let result = cacheService.get<TmdbSearchResult>(cacheKey)

    if (!result) {
      try {
        result = await this.tmdb.getTrending(type as any, window as any)
        cacheService.set(cacheKey, result, 600)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const jellyfinSync = new JellyfinSync(this.jellyfin, user.jellyfinToken, user.jellyfinId)
    const items = result.results.filter((item) => item.media_type !== 'person') as any[]
    const batchItems = items.map((item) => ({
      tmdbId: item.id,
      mediaType: item.media_type as 'movie' | 'tv',
    }))

    const availabilityMap = await jellyfinSync.checkBatchAvailability(batchItems)

    const enrichedResults = items.map((item) => {
      const key = `${item.media_type}:${item.id}`
      const availability = availabilityMap.get(key)
      return transformSearchResult(item, {
        available: availability?.available ?? false,
        itemId: availability?.jellyfinItemId,
      })
    })

    return {
      page: result.page,
      total_pages: result.total_pages,
      total_results: result.total_results,
      results: enrichedResults,
    }
  }

  /**
   * GET /discover
   */
  async discover({ request, response, auth }: HttpContext) {
    const { type, genre, year, rating, sort, page = 1 } = await request.validateUsing(discoverValidator)
    const user = auth.user!

    const cacheKey = `discover:${type}:${genre}:${year}:${rating}:${sort}:${page}`
    let result = cacheService.get<TmdbSearchResult>(cacheKey)

    if (!result) {
      try {
        result = await this.tmdb.discover(type as any, {
          genre,
          year,
          voteAverage: rating,
          sortBy: sort as any,
          page,
        })
        cacheService.set(cacheKey, result, 600)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    const jellyfinSync = new JellyfinSync(this.jellyfin, user.jellyfinToken, user.jellyfinId)
    const items = result.results as any[]
    const batchItems = items.map((item) => ({
      tmdbId: item.id,
      mediaType: type as 'movie' | 'tv',
    }))

    const availabilityMap = await jellyfinSync.checkBatchAvailability(batchItems)

    const enrichedResults = items.map((item) => {
      const key = `${type}:${item.id}`
      const availability = availabilityMap.get(key)
      return transformSearchResult(item, {
        available: availability?.available ?? false,
        itemId: availability?.jellyfinItemId,
      })
    })

    return {
      page: result.page,
      total_pages: result.total_pages,
      total_results: result.total_results,
      results: enrichedResults,
    }
  }

  /**
   * GET /genres
   */
  async genres({ request, response }: HttpContext) {
    const { type } = await request.validateUsing(genresValidator)

    const cacheKey = `genres:${type}`
    let genres = cacheService.get<any[]>(cacheKey)

    if (!genres) {
      try {
        genres = await this.tmdb.getGenres(type as any)
        cacheService.set(cacheKey, genres, 3600)
      } catch (error) {
        return response.status(502).json({
          message: 'TMDB service unavailable',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return { genres }
  }
}
