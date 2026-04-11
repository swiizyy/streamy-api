import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import MediaRequest from '#models/media_request'
import type User from '#models/user'
import TmdbClient from '#services/tmdb_client'
import NotificationService from '#services/notification_service'
import DownloadTracker from '#services/download_tracker'
import ServiceInstance from '#models/service_instance'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import {
  SeerrRequestStatus,
  SeerrMediaType,
  SeerrUserTransformer,
} from '../transformers/seerr_transformer.js'

/**
 * Map an internal string status to a Seerr numeric status.
 */
function toSeerrStatus(status: MediaRequest['status']): number {
  switch (status) {
    case 'pending':
      return SeerrRequestStatus.PENDING
    case 'approved':
      return SeerrRequestStatus.APPROVED
    case 'declined':
      return SeerrRequestStatus.DECLINED
    case 'available':
      return SeerrRequestStatus.AVAILABLE
    case 'downloading':
      return SeerrRequestStatus.DOWNLOADING
    default:
      return SeerrRequestStatus.PENDING
  }
}

/**
 * Serialize a MediaRequest into the Seerr-compatible JSON format.
 */
function serializeRequest(req: MediaRequest & { user?: User }): Record<string, unknown> {
  return {
    id: req.id,
    status: toSeerrStatus(req.status),
    type: req.mediaType,
    is4k: false,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    requestedBy: req.user ? SeerrUserTransformer.transform(req.user) : undefined,
    media: {
      mediaType: req.mediaType === 'movie' ? SeerrMediaType.MOVIE : SeerrMediaType.TV,
      tmdbId: req.tmdbId,
      title: req.title,
      seasons: req.seasons,
      status: req.status === 'available' ? 5 : req.status === 'downloading' ? 3 : 1,
    },
  }
}

const requestCreateValidator = vine.compile(
  vine.object({
    mediaType: vine.enum(['movie', 'tv'] as const),
    mediaId: vine.number(),
    seasons: vine.array(vine.number().withoutDecimals().positive()).optional(),
  })
)

const requestListValidator = vine.compile(
  vine.object({
    take: vine.number().positive().optional(),
    skip: vine.number().min(0).optional(),
    filter: vine
      .enum([
        'all',
        'approved',
        'available',
        'pending',
        'processing',
        'declined',
        'failed',
        'deleted',
        'completed',
      ] as const)
      .optional(),
    sort: vine.enum(['added', 'modified'] as const).optional(),
    sortDirection: vine.enum(['asc', 'desc'] as const).optional(),
    requestedBy: vine.number().optional(),
    mediaType: vine.enum(['movie', 'tv', 'all'] as const).optional(),
  })
)

/**
 * Seerr-compatible requests controller.
 *
 * Exposes the `/api/v1/request*` endpoints expected by Seerr-compatible
 * clients (e.g. Streamyfin).  Maps internal request data to the Seerr
 * numeric-status, camelCase format.
 */
@inject()
export default class SeerrRequestsController {
  constructor(
    private tmdb: TmdbClient,
    private tracker: DownloadTracker,
    private notifications: NotificationService
  ) {}

  /**
   * GET /api/v1/request
   */
  async index({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const {
      take: rawTake = 20,
      skip = 0,
      filter,
      sort = 'added',
      sortDirection = 'desc',
      requestedBy,
      mediaType,
    } = await request.validateUsing(requestListValidator)
    const take = Math.min(rawTake, 100)

    const applyFilters = (q: ReturnType<typeof MediaRequest.query>) => {
      if (user.role !== 'admin') {
        q.where('user_id', user.id)
      } else if (requestedBy) {
        q.where('user_id', requestedBy)
      }

      if (mediaType && mediaType !== 'all') {
        q.where('media_type', mediaType)
      }

      if (filter && filter !== 'all') {
        const statusMap: Record<string, string> = {
          approved: 'approved',
          available: 'available',
          pending: 'pending',
          processing: 'downloading',
          completed: 'available',
          declined: 'declined',
          failed: 'failed',
          deleted: 'deleted',
        }
        const mapped = statusMap[filter]
        if (mapped) {
          q.where('status', mapped)
        }
      }

      return q
    }

    const countRow = await applyFilters(MediaRequest.query()).count('* as c').first()
    const totalCount = Number(countRow?.$extras.c ?? 0)

    const results = await applyFilters(
      MediaRequest.query()
        .preload('user')
        .orderBy(sort === 'added' ? 'created_at' : 'updated_at', sortDirection)
    )
      .offset(skip)
      .limit(take)

    const page = Math.floor(skip / take) + 1
    const pages = Math.ceil(totalCount / take) || 1

    return {
      pageInfo: {
        page,
        pages,
        results: totalCount,
      },
      results: results.map(serializeRequest),
    }
  }

  /**
   * POST /api/v1/request
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(requestCreateValidator)

    const duplicate = await MediaRequest.query()
      .where('tmdb_id', payload.mediaId)
      .where('media_type', payload.mediaType)
      .whereNot('status', 'declined')
      .first()

    if (duplicate) {
      return response.status(409).json({ message: 'A request already exists for this media' })
    }

    let title: string
    try {
      if (payload.mediaType === 'movie') {
        const movie = await this.tmdb.getMovie(payload.mediaId)
        title = movie.title
      } else {
        const show = await this.tmdb.getTvShow(payload.mediaId)
        title = show.name
      }
    } catch {
      return response.status(502).json({ message: 'Failed to fetch media details from TMDB' })
    }

    const created = await MediaRequest.create({
      userId: user.id,
      tmdbId: payload.mediaId,
      mediaType: payload.mediaType,
      title,
      status: 'pending',
      requestedAt: DateTime.now(),
      seasons: payload.seasons || null,
    })

    await this.notifications.notifyAdmins(
      'new_request',
      'Nouvelle demande media',
      `${user.username} a demande: ${title}`
    )

    await created.load('user')

    return response.status(201).json(serializeRequest(created))
  }

  /**
   * GET /api/v1/request/count
   */
  async count({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const baseQuery =
      user.role !== 'admin' ? MediaRequest.query().where('user_id', user.id) : MediaRequest.query()

    const [total, pending, approved, declined, downloading, available] = await Promise.all([
      baseQuery.clone().count('* as c').first(),
      baseQuery.clone().where('status', 'pending').count('* as c').first(),
      baseQuery.clone().where('status', 'approved').count('* as c').first(),
      baseQuery.clone().where('status', 'declined').count('* as c').first(),
      baseQuery.clone().where('status', 'downloading').count('* as c').first(),
      baseQuery.clone().where('status', 'available').count('* as c').first(),
    ])

    const movies = await baseQuery.clone().where('media_type', 'movie').count('* as c').first()
    const tv = await baseQuery.clone().where('media_type', 'tv').count('* as c').first()

    return {
      total: Number(total?.$extras.c ?? 0),
      movie: Number(movies?.$extras.c ?? 0),
      tv: Number(tv?.$extras.c ?? 0),
      pending: Number(pending?.$extras.c ?? 0),
      approved: Number(approved?.$extras.c ?? 0),
      declined: Number(declined?.$extras.c ?? 0),
      processing: Number(downloading?.$extras.c ?? 0),
      available: Number(available?.$extras.c ?? 0),
      completed: Number(available?.$extras.c ?? 0),
    }
  }

  /**
   * GET /api/v1/request/:requestId
   */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const mediaRequest = await MediaRequest.query()
      .where('id', params.requestId)
      .preload('user')
      .firstOrFail()

    if (user.role !== 'admin' && mediaRequest.userId !== user.id) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    return serializeRequest(mediaRequest)
  }

  /**
   * POST /api/v1/request/:requestId/:status
   */
  async updateStatus({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Admin role required' })
    }

    const status = params.status as string
    if (!['approve', 'decline'].includes(status)) {
      return response.badRequest({ message: 'Invalid status. Must be approve or decline.' })
    }

    const mediaRequest = await MediaRequest.query()
      .where('id', params.requestId)
      .preload('user')
      .firstOrFail()

    if (mediaRequest.status !== 'pending') {
      return response.status(422).json({ message: 'Only pending requests can be processed' })
    }

    mediaRequest.respondedBy = user.id
    mediaRequest.respondedAt = DateTime.now()

    if (status === 'decline') {
      mediaRequest.status = 'declined'
      await mediaRequest.save()

      await this.notifications.notify(
        mediaRequest.userId,
        'request_declined',
        'Demande refusee',
        `Votre demande "${mediaRequest.title}" a ete refusee.`
      )

      return serializeRequest(mediaRequest)
    }

    // approve path — find default service instance
    const defaultInstance = await ServiceInstance.query()
      .apply((scopes) => scopes.default())
      .where('type', mediaRequest.mediaType === 'movie' ? 'radarr' : 'sonarr')
      .first()

    if (!defaultInstance) {
      return response.status(422).json({
        message: `No active default ${mediaRequest.mediaType === 'movie' ? 'Radarr' : 'Sonarr'} instance configured`,
      })
    }

    mediaRequest.serviceInstanceId = defaultInstance.id
    mediaRequest.status = 'approved'
    await mediaRequest.save()

    await this.notifications.notify(
      mediaRequest.userId,
      'request_approved',
      'Demande approuvee',
      `Votre demande "${mediaRequest.title}" a ete approuvee.`
    )

    queueMicrotask(() => {
      void this.tracker.dispatch(mediaRequest).catch((error) => {
        logger.error(
          { error, requestId: mediaRequest.id },
          'Failed to dispatch approved media request'
        )
      })
    })

    return serializeRequest(mediaRequest)
  }

  /**
   * DELETE /api/v1/request/:requestId
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const mediaRequest = await MediaRequest.findOrFail(params.requestId)

    const isAdmin = user.role === 'admin'
    const isOwnerPending = mediaRequest.userId === user.id && mediaRequest.status === 'pending'

    if (!isAdmin && !isOwnerPending) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    await mediaRequest.delete()
    return response.noContent()
  }
}
