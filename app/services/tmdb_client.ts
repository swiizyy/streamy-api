import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type {
  TmdbSearchResult,
  TmdbMovie,
  TmdbTvShow,
  TmdbSeason,
  TmdbGenre,
  DiscoverFilters,
} from '#services/tmdb_types'

export default class TmdbClient {
  protected baseUrl: string
  protected apiKey: string

  constructor() {
    this.baseUrl = env.get('TMDB_BASE_URL') || 'https://api.themoviedb.org/3'
    this.apiKey = env.get('TMDB_API_KEY')
  }

  /**
   * Add common query parameters (api_key, language)
   */
  private buildUrl(endpoint: string, params: Record<string, any> = {}, language: string = 'fr-FR'): string {
    const queryParams = new URLSearchParams({
      api_key: this.apiKey,
      language,
      ...Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)),
    })
    return `${this.baseUrl}${endpoint}?${queryParams.toString()}`
  }

  /**
   * Generic fetch wrapper
   */
  private async fetch<T>(url: string): Promise<T> {
    logger.debug({ url }, 'Fetching from TMDB')
    const response = await fetch(url)

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error')
      logger.error({ status: response.status, error }, 'TMDB API error')
      throw new Error(`TMDB API error: ${response.status} - ${error}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Search multi (movies + tv + people)
   * GET /search/multi
   */
  async searchMulti(query: string, page: number = 1, language: string = 'fr-FR'): Promise<TmdbSearchResult> {
    const url = this.buildUrl('/search/multi', { query, page }, language)
    return this.fetch<TmdbSearchResult>(url)
  }

  /**
   * Search movies
   * GET /search/movie
   */
  async searchMovie(query: string, page: number = 1, language: string = 'fr-FR'): Promise<TmdbSearchResult> {
    const url = this.buildUrl('/search/movie', { query, page }, language)
    return this.fetch<TmdbSearchResult>(url)
  }

  /**
   * Search TV shows
   * GET /search/tv
   */
  async searchTv(query: string, page: number = 1, language: string = 'fr-FR'): Promise<TmdbSearchResult> {
    const url = this.buildUrl('/search/tv', { query, page }, language)
    return this.fetch<TmdbSearchResult>(url)
  }

  /**
   * Get movie details
   * GET /movie/{id}
   */
  async getMovie(tmdbId: number, language: string = 'fr-FR'): Promise<TmdbMovie> {
    const url = this.buildUrl(
      `/movie/${tmdbId}`,
      {
        append_to_response: 'credits,videos,recommendations,similar,external_ids',
      },
      language
    )
    return this.fetch<TmdbMovie>(url)
  }

  /**
   * Get TV show details
   * GET /tv/{id}
   */
  async getTvShow(tmdbId: number, language: string = 'fr-FR'): Promise<TmdbTvShow> {
    const url = this.buildUrl(
      `/tv/${tmdbId}`,
      {
        append_to_response: 'credits,videos,recommendations,similar,external_ids',
      },
      language
    )
    return this.fetch<TmdbTvShow>(url)
  }

  /**
   * Get TV season details
   * GET /tv/{id}/season/{seasonNumber}
   */
  async getTvSeason(tmdbId: number, seasonNumber: number, language: string = 'fr-FR'): Promise<TmdbSeason> {
    const url = this.buildUrl(`/tv/${tmdbId}/season/${seasonNumber}`, {}, language)
    return this.fetch<TmdbSeason>(url)
  }

  /**
   * Get trending media
   * GET /trending/{mediaType}/{timeWindow}
   */
  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'week',
    language: string = 'fr-FR'
  ): Promise<TmdbSearchResult> {
    const url = this.buildUrl(`/trending/${mediaType}/${timeWindow}`, {}, language)
    return this.fetch<TmdbSearchResult>(url)
  }

  /**
   * Discover media with filters
   * GET /discover/{mediaType}
   */
  async discover(
    mediaType: 'movie' | 'tv',
    filters: DiscoverFilters = {},
    language: string = 'fr-FR'
  ): Promise<TmdbSearchResult> {
    const params: Record<string, any> = {
      ...(filters.genre && { with_genres: filters.genre }),
      ...(filters.year && { year: filters.year }),
      ...(filters.voteAverage && { 'vote_average.gte': filters.voteAverage }),
      ...(filters.sortBy && { sort_by: filters.sortBy }),
      page: filters.page || 1,
    }
    const url = this.buildUrl(`/discover/${mediaType}`, params, language)
    return this.fetch<TmdbSearchResult>(url)
  }

  /**
   * Get genre list
   * GET /genre/{mediaType}/list
   */
  async getGenres(mediaType: 'movie' | 'tv' = 'movie', language: string = 'fr-FR'): Promise<TmdbGenre[]> {
    const url = this.buildUrl(`/genre/${mediaType}/list`, {}, language)
    const data = await this.fetch<{ genres: TmdbGenre[] }>(url)
    return data.genres
  }
}
