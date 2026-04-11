/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const SearchController = () => import('#controllers/search_controller')
const RequestsController = () => import('#controllers/requests_controller')
const DownloadsController = () => import('#controllers/downloads_controller')
const ServicesController = () => import('#controllers/services_controller')
const WebhooksController = () => import('#controllers/webhooks_controller')
const StatsController = () => import('#controllers/stats_controller')

router.get('/', () => ({ hello: 'StreamyAPI' }))

router.post('/auth/login', [AuthController, 'login'])
router.post('/webhooks/jellyfin', [WebhooksController, 'jellyfin'])

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

    router.post('/requests', [RequestsController, 'store'])
    router.get('/requests', [RequestsController, 'index'])
    router.get('/requests/:id', [RequestsController, 'show'])
    router.put('/requests/:id', [RequestsController, 'update'])
    router.delete('/requests/:id', [RequestsController, 'destroy'])
    router.get('/requests/:id/download', [DownloadsController, 'show'])

    router.get('/stats/me', [StatsController, 'me'])
    router.get('/stats/history', [StatsController, 'history'])
    router.get('/stats/activity', [StatsController, 'activity'])
    router.get('/stats/user/:id', [StatsController, 'user'])
  })
  .use(middleware.auth())

router
  .group(() => {
    router.get('/downloads', [DownloadsController, 'index'])
    router.post('/admin/services', [ServicesController, 'store'])
    router.get('/admin/services', [ServicesController, 'index'])
    router.put('/admin/services/:id', [ServicesController, 'update'])
    router.delete('/admin/services/:id', [ServicesController, 'destroy'])
    router.get('/admin/services/:id/test', [ServicesController, 'test'])
    router.get('/admin/services/:id/profiles', [ServicesController, 'profiles'])
    router.get('/admin/services/:id/root-folders', [ServicesController, 'rootFolders'])
    router.get('/stats/global', [StatsController, 'global'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))

