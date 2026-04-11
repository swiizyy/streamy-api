import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import TmdbClient from '#services/tmdb_client'
import cacheService from '#services/cache'
import JellyfinClient from '#services/jellyfin_client'
import type { TmdbSearchResult, TmdbMovie, TmdbTvShow, TmdbSeason } from '#services/tmdb_types'

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------

function makeTmdbSearchResult(overrides: any = {}): TmdbSearchResult {
  return {
    page: 1,
    total_pages: 50,
    total_results: 1000,
    results: [
      {
        id: 27205,
        media_type: 'movie',
        title: 'Inception',
        overview: 'A thief who steals corporate secrets through dream-sharing...',
        poster_path: '/qmDpIHrmpJw2v9IjHVPS5PgaAoU.jpg',
        backdrop_path: '/s3TBrA08fe8cT6nWQYAQv8JF8zG.jpg',
        release_date: '2010-07-15',
        vote_average: 8.8,
        vote_count: 34123,
        popularity: 45.2,
        genre_ids: [28, 12, 14],
        original_language: 'en',
        adult: false,
      },
    ],
    ...overrides,
  }
}

function makeTmdbMovie(overrides: any = {}): TmdbMovie {
  return {
    id: 27205,
    title: 'Inception',
    original_title: 'Inception',
    overview: 'A thief who steals corporate secrets through dream-sharing...',
    release_date: '2010-07-15',
    runtime: 148,
    status: 'Released',
    tagline: 'Your mind is the scene of the crime',
    poster_path: '/qmDpIHrmpJw2v9IjHVPS5PgaAoU.jpg',
    backdrop_path: '/s3TBrA08fe8cT6nWQYAQv8JF8zG.jpg',
    budget: 160000000,
    revenue: 839027430,
    vote_average: 8.8,
    vote_count: 34123,
    popularity: 45.2,
    genres: [
      { id: 28, name: 'Action' },
      { id: 12, name: 'Adventure' },
      { id: 14, name: 'Fantasy' },
    ],
    production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
    spoken_languages: [{ iso_639_1: 'en', name: 'English' }],
    original_language: 'en',
    adult: false,
    imdb_id: 'tt1375666',
    credits: {
      cast: [
        {
          id: 500,
          name: 'Tom Hardy',
          original_name: 'Tom Hardy',
          known_for_department: 'Acting',
          popularity: 25.5,
          profile_path: '/profile.jpg',
          adult: false,
          gender: 2,
          character: 'Eames',
          credit_id: 'abc123',
          order: 3,
        },
      ],
      crew: [],
    },
    videos: {
      results: [
        {
          id: 'vid123',
          iso_639_1: 'en',
          iso_3166_1: 'US',
          key: 'YoHD3dixWic',
          name: 'Inception - Trailer',
          official: true,
          published_at: '2010-04-09T00:00:00.000Z',
          site: 'YouTube',
          size: 1080,
          type: 'Trailer',
        },
      ],
    },
    recommendations: makeTmdbSearchResult(),
    similar: makeTmdbSearchResult(),
    ...overrides,
  }
}

function makeTmdbTvShow(overrides: any = {}): TmdbTvShow {
  return {
    id: 1396,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer...',
    first_air_date: '2008-01-20',
    last_air_date: '2013-09-29',
    status: 'Ended',
    type: 'Scripted',
    number_of_seasons: 5,
    number_of_episodes: 62,
    episode_run_time: [47, 48],
    genres: [
      { id: 18, name: 'Drama' },
      { id: 80, name: 'Crime' },
    ],
    production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
    spoken_languages: [{ iso_639_1: 'en', name: 'English' }],
    original_language: 'en',
    vote_average: 9.5,
    vote_count: 16000,
    popularity: 134.2,
    poster_path: '/ggJllPS8RMTL2z6Ba results.jpg',
    backdrop_path: '/xnZeaDy1b9yvDSuvvMxt0Mkr137.jpg',
    in_production: false,
    networks: [
      {
        id: 20,
        name: 'AMC',
        logo_path: '/amc_log.png',
        origin_country: 'US',
      },
    ],
    production_companies: [],
    seasons: [
      {
        id: 3971,
        name: 'Season 1',
        season_number: 1,
        episode_count: 7,
        poster_path: '/season1.jpg',
        air_date: '2008-01-20',
      },
    ],
    credits: {
      cast: [],
      crew: [],
    },
    videos: { results: [] },
    recommendations: makeTmdbSearchResult(),
    similar: makeTmdbSearchResult(),
    ...overrides,
  }
}

function makeTmdbSeason(overrides: any = {}): TmdbSeason {
  return {
    id: 3971,
    name: 'Season 1',
    overview: 'Season 1 overview...',
    season_number: 1,
    air_date: '2008-01-20',
    vote_average: 9.2,
    poster_path: '/season1.jpg',
    episodes: [
      {
        id: 349232,
        name: 'Pilot',
        overview: 'The pilot episode...',
        episode_number: 1,
        season_number: 1,
        air_date: '2008-01-20',
        runtime: 58,
        still_path: '/still.jpg',
        vote_average: 8.9,
        vote_count: 1200,
        show_id: 1396,
        production_code: 'BCS01E01',
        crew: [],
        guest_stars: [],
      },
    ],
    ...overrides,
  }
}

/** Fake TmdbClient */
function fakeTmdbClient(fakeOverrides: any = {}) {
  class FakeTmdbClient extends TmdbClient {
    async searchMulti(query: string, page: number = 1) {
      return fakeOverrides.searchMulti?.(query, page) ?? makeTmdbSearchResult()
    }
    async searchMovie(query: string, page: number = 1) {
      return fakeOverrides.searchMovie?.(query, page) ?? makeTmdbSearchResult()
    }
    async searchTv(query: string, page: number = 1) {
      return fakeOverrides.searchTv?.(query, page) ?? makeTmdbSearchResult()
    }
    async getMovie(tmdbId: number) {
      return fakeOverrides.getMovie?.(tmdbId) ?? makeTmdbMovie()
    }
    async getTvShow(tmdbId: number) {
      return fakeOverrides.getTvShow?.(tmdbId) ?? makeTmdbTvShow()
    }
    async getTvSeason(tmdbId: number, seasonNumber: number) {
      return fakeOverrides.getTvSeason?.(tmdbId, seasonNumber) ?? makeTmdbSeason()
    }
    async getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week') {
      return fakeOverrides.getTrending?.(mediaType, timeWindow) ?? makeTmdbSearchResult()
    }
    async discover(mediaType: 'movie' | 'tv', filters: any = {}) {
      return fakeOverrides.discover?.(mediaType, filters) ?? makeTmdbSearchResult()
    }
    async getGenres(mediaType: 'movie' | 'tv' = 'movie') {
      return fakeOverrides.getGenres?.(mediaType) ?? [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
      ]
    }
  }

  app.container.swap(TmdbClient, () => new FakeTmdbClient())
}

/** Fake JellyfinClient */
function fakeJellyfinClient() {
  class FakeJellyfinClient extends JellyfinClient {
    getBaseUrl(): string {
      return 'http://jellyfin.local:8096'
    }
    // @ts-ignore
    async authenticate(_username: string, _password: string) {
      throw new Error('Not used in tests')
    }
    // @ts-ignore
    async getUser(_jellyfinUserId: string, _token: string) {
      throw new Error('Not used in tests')
    }
    // @ts-ignore
    async isAdmin(_jellyfinUserId: string, _token: string) {
      throw new Error('Not used in tests')
    }
  }

  // @ts-ignore
  app.container.swap(JellyfinClient, () => new FakeJellyfinClient())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.group('Search — GET /search', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
    app.container.restore(JellyfinClient)
  })

  test('returns search results with Jellyfin availability status', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-search-001',
      username: 'searchuser',
      jellyfinToken: 'jf-token-search',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/search?q=Inception&type=multi&page=1')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.exists(response.body().results)
    assert.isArray(response.body().results)
    assert.equal(response.body().page, 1)

    const item = response.body().results[0]
    assert.equal(item.media_type, 'movie')
    assert.equal(item.title, 'Inception')
    assert.exists(item.jellyfin)
    assert.isBoolean(item.jellyfin.available)
  })

  test('returns image URLs with full path', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-search-002',
      username: 'searchuser2',
      jellyfinToken: 'jf-token-search2',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/search?q=Inception')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    const item = response.body().results[0]
    assert.match(item.poster_path, /^https:\/\/image\.tmdb\.org/)
    assert.match(item.backdrop_path, /^https:\/\/image\.tmdb\.org/)
  })

  test('returns 401 when not authenticated', async ({ client }) => {
    const response = await client.get('/search?q=Inception')
    response.assertStatus(401)
  })

  test('returns 422 when query is missing', async ({ client }) => {
    const user = await User.create({
      jellyfinId: 'jf-search-003',
      username: 'searchuser3',
      jellyfinToken: 'jf-token-search3',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    const response = await client
      .get('/search')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(422)
  })

  test('caches results correctly', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-search-004',
      username: 'searchuser4',
      jellyfinToken: 'jf-token-search4',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    let callCount = 0
    fakeTmdbClient({
      searchMulti: () => {
        callCount++
        return makeTmdbSearchResult()
      },
    })
    fakeJellyfinClient()

    const authHeader = `Bearer ${token.value!.release()}`

    // First call should hit TMDB
    await client.get('/search?q=Inception').header('Authorization', authHeader)
    assert.equal(callCount, 1)

    // Second call should use cache
    await client.get('/search?q=Inception').header('Authorization', authHeader)
    assert.equal(callCount, 1)

    // Different query should hit TMDB again
    await client.get('/search?q=Interstellar').header('Authorization', authHeader)
    assert.equal(callCount, 2)
  })

  test('returns 502 when TMDB is unavailable', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-search-005',
      username: 'searchuser5',
      jellyfinToken: 'jf-token-search5',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient({
      searchMulti: () => {
        throw new Error('TMDB API error: 503 - Service Unavailable')
      },
    })
    fakeJellyfinClient()

    const response = await client
      .get('/search?q=Inception')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(502)
    assert.equal(response.body().message, 'TMDB service unavailable')
  })
})

test.group('Search — GET /movies/:tmdbId', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
    app.container.restore(JellyfinClient)
  })

  test('returns movie details with Jellyfin availability', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-movie-001',
      username: 'movieuser',
      jellyfinToken: 'jf-token-movie',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/movies/27205')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.equal(response.body().title, 'Inception')
    assert.equal(response.body().tmdb_id, 27205)
    assert.exists(response.body().cast)
    assert.exists(response.body().jellyfin)
  })

  test('returns full image URLs', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-movie-002',
      username: 'movieuser2',
      jellyfinToken: 'jf-token-movie2',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/movies/27205')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.match(response.body().poster_path, /^https:\/\/image\.tmdb\.org/)
    assert.match(response.body().backdrop_path, /^https:\/\/image\.tmdb\.org/)
  })

  test('caches movie details', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-movie-003',
      username: 'movieuser3',
      jellyfinToken: 'jf-token-movie3',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    let callCount = 0
    fakeTmdbClient({
      getMovie: () => {
        callCount++
        return makeTmdbMovie()
      },
    })
    fakeJellyfinClient()

    const authHeader = `Bearer ${token.value!.release()}`

    await client.get('/movies/27205').header('Authorization', authHeader)
    assert.equal(callCount, 1)

    await client.get('/movies/27205').header('Authorization', authHeader)
    assert.equal(callCount, 1)
  })
})

test.group('Search — GET /tv/:tmdbId', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
    app.container.restore(JellyfinClient)
  })

  test('returns TV show details with Jellyfin availability', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-tv-001',
      username: 'tvuser',
      jellyfinToken: 'jf-token-tv',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/tv/1396')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.equal(response.body().name, 'Breaking Bad')
    assert.equal(response.body().tmdb_id, 1396)
    assert.exists(response.body().seasons)
    assert.exists(response.body().jellyfin)
  })

  test('returns formatted season and network data', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-tv-002',
      username: 'tvuser2',
      jellyfinToken: 'jf-token-tv2',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/tv/1396')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.isArray(response.body().seasons)
    assert.isArray(response.body().networks)
    assert.exists(response.body().seasons[0].season_number)
  })
})

test.group('Search — GET /tv/:tmdbId/season/:seasonNumber', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
  })

  test('returns season details with episodes', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-season-001',
      username: 'seasonuser',
      jellyfinToken: 'jf-token-season',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()

    const response = await client
      .get('/tv/1396/season/1')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.equal(response.body().season_number, 1)
    assert.isArray(response.body().episodes)
    assert.isNotEmpty(response.body().episodes)
  })
})

test.group('Search — GET /trending', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
    app.container.restore(JellyfinClient)
  })

  test('returns trending media with filters', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-trend-001',
      username: 'trenduser',
      jellyfinToken: 'jf-token-trend',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/trending?type=movie&window=week')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.isArray(response.body().results)
    assert.exists(response.body().page)
  })
})

test.group('Search — GET /discover', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
    app.container.restore(JellyfinClient)
  })

  test('returns discovered media with genre filters', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-discover-001',
      username: 'discoveruser',
      jellyfinToken: 'jf-token-discover',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()
    fakeJellyfinClient()

    const response = await client
      .get('/discover?type=movie&genre=28&year=2024')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.isArray(response.body().results)
  })
})

test.group('Search — GET /genres', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.teardown(() => {
    cacheService.clear()
    app.container.restore(TmdbClient)
  })

  test('returns genre list for movies', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-genre-001',
      username: 'genreuser',
      jellyfinToken: 'jf-token-genre',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    fakeTmdbClient()

    const response = await client
      .get('/genres?type=movie')
      .header('Authorization', `Bearer ${token.value!.release()}`)

    response.assertStatus(200)
    assert.isArray(response.body().genres)
    assert.exists(response.body().genres[0].id)
    assert.exists(response.body().genres[0].name)
  })

  test('caches genres with long TTL', async ({ client, assert }) => {
    const user = await User.create({
      jellyfinId: 'jf-genre-002',
      username: 'genreuser2',
      jellyfinToken: 'jf-token-genre2',
      role: 'user',
    })
    const token = await User.accessTokens.create(user)

    let callCount = 0
    fakeTmdbClient({
      getGenres: () => {
        callCount++
        return [{ id: 28, name: 'Action' }]
      },
    })

    const authHeader = `Bearer ${token.value!.release()}`

    await client.get('/genres?type=movie').header('Authorization', authHeader)
    assert.equal(callCount, 1)

    await client.get('/genres?type=movie').header('Authorization', authHeader)
    assert.equal(callCount, 1)
  })
})
