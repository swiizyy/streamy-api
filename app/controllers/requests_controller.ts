import MediaRequest from '#models/media_request'
import ServiceInstance from '#models/service_instance'
import DownloadTracker from '#services/download_tracker'
import NotificationService from '#services/notification_service'
import TmdbClient from '#services/tmdb_client'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

const requestStoreValidator = vine.compile(
  vine.object({
    tmdb_id: vine.number(),
    media_type: vine.enum(['movie', 'tv'] as const),
    seasons: vine.array(vine.number().withoutDecimals().positive()).optional(),
    notes: vine.string().trim().optional(),
  })
)

const requestUpdateValidator = vine.compile(
  vine.object({
    action: vine.enum(['approve', 'decline'] as const),
    service_instance_id: vine.number().optional(),
    notes: vine.string().trim().optional(),
  })
)

const requestIndexValidator = vine.compile(
  vine.object({
    status: vine.enum(['pending', 'approved', 'declined', 'downloading', 'available'] as const).optional(),
    type: vine.enum(['movie', 'tv'] as const).optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().optional(),
  })
)

@inject()
export default class RequestsController {
  constructor(
    private tmdb: TmdbClient,
    private tracker: DownloadTracker,
    private notifications: NotificationService
  ) {}

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(requestStoreValidator)

    const duplicate = await MediaRequest.query()
      .where('tmdb_id', payload.tmdb_id)
      .where('media_type', payload.media_type)
      .whereNot('status', 'declined')
      .first()

    if (duplicate) {
      return response.status(409).json({
        message: 'A request already exists for this media',
      })
    }

    let title: string
    if (payload.media_type === 'movie') {
      const movie = await this.tmdb.getMovie(payload.tmdb_id)
      title = movie.title
    } else {
      const show = await this.tmdb.getTvShow(payload.tmdb_id)
      title = show.name
    }

    const created = await MediaRequest.create({
      userId: user.id,
      tmdbId: payload.tmdb_id,
      mediaType: payload.media_type,
      title,
      status: 'pending',
      requestedAt: DateTime.now(),
      seasons: payload.seasons || null,
      notes: payload.notes || null,
    })

    await this.notifications.notifyAdmins(
      'new_request',
      'Nouvelle demande media',
      `${user.username} a demande: ${title}`
    )

    return response.created(created)
  }

  async index({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const filters = await request.validateUsing(requestIndexValidator)

    const page = filters.page || 1
    const limit = Math.min(filters.limit || 20, 100)

    const query = MediaRequest.query().preload('user').preload('serviceInstance').orderBy('created_at', 'desc')

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.type) {
      query.where('media_type', filters.type)
    }

    if (user.role !== 'admin') {
      query.where('user_id', user.id)
    }

    return query.paginate(page, limit)
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const mediaRequest = await MediaRequest.query()
      .where('id', params.id)
      .preload('user')
      .preload('serviceInstance')
      .firstOrFail()

    if (user.role !== 'admin' && mediaRequest.userId !== user.id) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    let download = null
    if (['approved', 'downloading'].includes(mediaRequest.status)) {
      try {
        download = await this.tracker.checkStatus(mediaRequest)
      } catch {
        download = { status: 'failed' }
      }
    }

    return {
      ...mediaRequest.serialize(),
      download,
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Admin role required' })
    }

    const payload = await request.validateUsing(requestUpdateValidator)
    const mediaRequest = await MediaRequest.findOrFail(params.id)

    if (mediaRequest.status !== 'pending') {
      return response.status(422).json({ message: 'Only pending requests can be processed' })
    }

    mediaRequest.respondedBy = user.id
    mediaRequest.respondedAt = DateTime.now()
    mediaRequest.notes = payload.notes || mediaRequest.notes

    if (payload.action === 'decline') {
      mediaRequest.status = 'declined'
      await mediaRequest.save()

      await this.notifications.notify(
        mediaRequest.userId,
        'request_declined',
        'Demande refusee',
        `Votre demande "${mediaRequest.title}" a ete refusee.`
      )

      return mediaRequest
    }

    if (payload.service_instance_id) {
      const selectedInstance = await ServiceInstance.query()
        .where('id', payload.service_instance_id)
        .where('is_active', true)
        .first()

      if (!selectedInstance) {
        return response.status(422).json({
          message: 'Selected service instance does not exist or is inactive',
        })
      }

      const expectedType = mediaRequest.mediaType === 'movie' ? 'radarr' : 'sonarr'
      if (selectedInstance.type !== expectedType) {
        return response.status(422).json({
          message: `Selected service must be of type ${expectedType}`,
        })
      }

      mediaRequest.serviceInstanceId = selectedInstance.id
    } else {
      const defaultInstance = await ServiceInstance.query()
        .apply((scopes) => scopes.default())
        .where('type', mediaRequest.mediaType === 'movie' ? 'radarr' : 'sonarr')
        .first()

      if (!defaultInstance) {
        return response.status(422).json({
          message: `No active default ${mediaRequest.mediaType === 'movie' ? 'Radarr' : 'Sonarr'} instance configured`,
        })
      }
    }

    mediaRequest.status = 'approved'
    await mediaRequest.save()

    await this.notifications.notify(
      mediaRequest.userId,
      'request_approved',
      'Demande approuvee',
      `Votre demande "${mediaRequest.title}" a ete approuvee et va etre envoyee au telechargement.`
    )

    // Run dispatch in the background to return quickly.
    queueMicrotask(() => {
      void this.tracker.dispatch(mediaRequest).catch((error) => {
        logger.error({ error, requestId: mediaRequest.id }, 'Failed to dispatch approved media request')
      })
    })

    return mediaRequest
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const mediaRequest = await MediaRequest.findOrFail(params.id)

    const isAdmin = user.role === 'admin'
    const isOwnerPending = mediaRequest.userId === user.id && mediaRequest.status === 'pending'

    if (!isAdmin && !isOwnerPending) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    await mediaRequest.delete()
    return response.noContent()
  }
}
