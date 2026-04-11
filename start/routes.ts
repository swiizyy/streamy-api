/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const SearchController = () => import('#controllers/search_controller')

router.get('/', () => ({ hello: 'StreamyAPI' }))

router.post('/auth/login', [AuthController, 'login'])

router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
    router.get('/auth/me', [AuthController, 'me'])
    router.get('/search', [SearchController, 'search'])
    router.get('/movies/:tmdbId', [SearchController, 'movie'])
    router.get('/tv/:tmdbId', [SearchController, 'tvShow'])
    router.get('/tv/:tmdbId/season/:seasonNumber', [SearchController, 'tvSeason'])
    router.get('/trending', [SearchController, 'trending'])
    router.get('/discover', [SearchController, 'discover'])
    router.get('/genres', [SearchController, 'genres'])
  })
  .use(middleware.auth())

