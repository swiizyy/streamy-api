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
const InvitesController = () => import('#controllers/invites_controller')
const ReferralsController = () => import('#controllers/referrals_controller')

// ── Feature-based domain controllers ─────────────────────────────────────────
const SeerrAuthController = () => import('#seerr/controllers/auth_controller')
const SeerrSearchController = () => import('#seerr/controllers/search_controller')
const SeerrRequestsController = () => import('#seerr/controllers/requests_controller')
const SeerrMovieController = () => import('#seerr/controllers/movie_controller')
const SeerrTvController = () => import('#seerr/controllers/tv_controller')
const SeerrUserController = () => import('#seerr/controllers/user_controller')
const StreamyStatsSearchController = () => import('#streamystats/controllers/search_controller')
const StreamyStatsRecommendationsController = () =>
  import('#streamystats/controllers/recommendations_controller')

router.get('/', () => ({ hello: 'StreamyAPI' }))

router.post('/auth/login', [AuthController, 'login'])
router.post('/webhooks/jellyfin', [WebhooksController, 'jellyfin'])
router.get('/join/:code', [InvitesController, 'joinPage'])
router.get('/invites/:code/validate', [InvitesController, 'validate'])
router.post('/invites/:code/redeem', [InvitesController, 'redeem'])

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

    router.post('/invites', [InvitesController, 'store']).use(middleware.inviteQuota())
    router.get('/invites', [InvitesController, 'index'])
    router.delete('/invites/:id', [InvitesController, 'destroy'])
    router.get('/referrals', [ReferralsController, 'index'])
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
    router.get('/referrals/tree', [ReferralsController, 'tree'])
    router.put('/admin/referrals/:id/revoke', [ReferralsController, 'revoke'])
    router.put('/admin/referrals/:id/extend', [ReferralsController, 'extend'])
    router.put('/admin/users/:id/quota', [ReferralsController, 'updateQuota'])
    router.get('/admin/libraries', [InvitesController, 'libraries'])
  })
  .use(middleware.auth())
  .use(middleware.role({ roles: ['admin'] }))

// ── Seerr-compatible API (/api/v1) ────────────────────────────────────────────
// Public endpoint — authentication is handled inside the controller.
router.post('/api/v1/auth/local', [SeerrAuthController, 'login'])

// Protected Seerr endpoints — use multiAuth to accept OAT or MediaBrowser tokens.
router
  .group(() => {
    router.get('/api/v1/auth/me', [SeerrAuthController, 'me'])

    // Search
    router.get('/api/v1/search', [SeerrSearchController, 'search'])

    // Requests — count must be registered before :requestId to avoid collision
    router.get('/api/v1/request/count', [SeerrRequestsController, 'count'])
    router.get('/api/v1/request', [SeerrRequestsController, 'index'])
    router.post('/api/v1/request', [SeerrRequestsController, 'store'])
    router.get('/api/v1/request/:requestId', [SeerrRequestsController, 'show'])
    router.post('/api/v1/request/:requestId/:status', [SeerrRequestsController, 'updateStatus'])
    router.delete('/api/v1/request/:requestId', [SeerrRequestsController, 'destroy'])

    // Movie & TV details
    router.get('/api/v1/movie/:movieId', [SeerrMovieController, 'show'])
    router.get('/api/v1/tv/:tvId', [SeerrTvController, 'show'])

    // Users
    router.get('/api/v1/user', [SeerrUserController, 'index'])
    router.get('/api/v1/user/:userId', [SeerrUserController, 'show'])
  })
  .use(middleware.multiAuth())

// ── StreamyStats-compatible API (/api) ────────────────────────────────────────
router
  .group(() => {
    router.get('/api/streamystats/search', [StreamyStatsSearchController, 'search']).as('streamystats.search')
    router.get('/api/streamystats/search/top', [StreamyStatsSearchController, 'top']).as('streamystats.search.top')
    // Canonical StreamyStats paths (aliased to avoid route-name collision)
    router.get('/api/search', [StreamyStatsSearchController, 'search']).as('api.search')
    router.get('/api/recommendations', [StreamyStatsRecommendationsController, 'index']).as('api.recommendations')
  })
  .use(middleware.multiAuth())

