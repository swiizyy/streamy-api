import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import TmdbClient from '#services/tmdb_client'
import { renderPage } from '#services/inertia_render'

@inject()
export default class InertiaSearchController {
  constructor(private tmdb: TmdbClient) {}

  async index(ctx: HttpContext) {
    const { request, auth } = ctx
    const user = auth.getUserOrFail()
    const query = request.input('q', '')
    const type = request.input('type', 'movie') as 'movie' | 'tv'

    let results: unknown[] = []
    if (query) {
      try {
        const searchResult =
          type === 'movie'
            ? await this.tmdb.searchMovie(query)
            : await this.tmdb.searchTv(query)
        results = searchResult.results.slice(0, 20)
      } catch {
        results = []
      }
    }

    return renderPage(ctx, 'search', {
      results,
      query,
      type,
      auth: { user: { id: user.id, username: user.username, role: user.role } },
    })
  }
}
