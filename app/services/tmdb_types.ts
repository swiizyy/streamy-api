/**
 * TMDB API v3 Types
 * Reference: https://www.themoviedb.org/settings/api
 */

// Search Results
export interface TmdbSearchResult {
  page: number
  results: TmdbSearchItem[]
  total_pages: number
  total_results: number
}

export interface TmdbSearchItem {
  id: number
  media_type: 'movie' | 'tv' | 'person'
  title?: string // Movie & TV
  name?: string // TV & Person
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string // Movie
  first_air_date?: string // TV
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  original_language: string
  adult: boolean
  original_title?: string // Movie
  original_name?: string // TV
  known_for?: TmdbSearchItem[] // Person
}

// Movie Details
export interface TmdbMovie {
  id: number
  title: string
  original_title: string
  overview: string
  release_date: string
  runtime: number // minutes
  status: string
  tagline: string
  poster_path: string | null
  backdrop_path: string | null
  budget: number
  revenue: number
  vote_average: number
  vote_count: number
  popularity: number
  genres: TmdbGenre[]
  production_countries: TmdbProductionCountry[]
  spoken_languages: TmdbSpokenLanguage[]
  original_language: string
  adult: boolean
  imdb_id: string | null
  external_ids?: {
    imdb_id: string | null
    wikidata_id: string | null
  }
  credits?: {
    cast: TmdbPerson[]
    crew: TmdbPerson[]
  }
  videos?: {
    results: TmdbVideo[]
  }
  recommendations?: TmdbSearchResult
  similar?: TmdbSearchResult
}

// TV Show Details
export interface TmdbTvShow {
  id: number
  name: string
  original_name: string
  overview: string
  first_air_date: string
  last_air_date: string | null
  status: string
  type: string
  number_of_seasons: number
  number_of_episodes: number
  episode_run_time: number[]
  genres: TmdbGenre[]
  production_countries: TmdbProductionCountry[]
  spoken_languages: TmdbSpokenLanguage[]
  original_language: string
  vote_average: number
  vote_count: number
  popularity: number
  poster_path: string | null
  backdrop_path: string | null
  in_production: boolean
  networks: TmdbNetwork[]
  production_companies: TmdbProductionCompany[]
  seasons: TmdbSeasonOverview[]
  external_ids?: {
    imdb_id: string | null
    wikidata_id: string | null
  }
  credits?: {
    cast: TmdbPerson[]
    crew: TmdbPerson[]
  }
  videos?: {
    results: TmdbVideo[]
  }
  recommendations?: TmdbSearchResult
  similar?: TmdbSearchResult
}

// Season Details
export interface TmdbSeason {
  id: number
  name: string
  overview: string
  season_number: number
  air_date: string | null
  vote_average: number
  poster_path: string | null
  episodes: TmdbEpisode[]
}

export interface TmdbSeasonOverview {
  id: number
  name: string
  season_number: number
  episode_count: number
  poster_path: string | null
  air_date: string | null
}

// Episode Details
export interface TmdbEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string | null
  runtime: number | null
  still_path: string | null
  vote_average: number
  vote_count: number
  show_id: number
  production_code: string | null
  crew: TmdbPerson[]
  guest_stars: TmdbPerson[]
}

// Person / Cast & Crew
export interface TmdbPerson {
  id: number
  name: string
  original_name: string
  known_for_department: string
  popularity: number
  profile_path: string | null
  adult: boolean
  gender: number // 0=unspecified, 1=female, 2=male
  // For cast
  character?: string
  credit_id?: string
  order?: number
  // For crew
  job?: string
  department?: string
}

// Genre
export interface TmdbGenre {
  id: number
  name: string
}

// Networks
export interface TmdbNetwork {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

// Production
export interface TmdbProductionCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TmdbProductionCountry {
  iso_3166_1: string
  name: string
}

export interface TmdbSpokenLanguage {
  iso_639_1: string
  name: string
}

// Videos / Trailers
export interface TmdbVideo {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string // YouTube video key
  name: string
  official: boolean
  published_at: string
  site: string
  size: number
  type: string // "Trailer", "Teaser", "Clip", etc.
}

// Discovery Filters
export interface DiscoverFilters {
  genre?: number
  year?: number
  voteAverage?: number
  sortBy?: 'popularity.asc' | 'popularity.desc' | 'vote_average.asc' | 'vote_average.desc' | 'release_date.asc' | 'release_date.desc'
  page?: number
}
