import MediaRequest from '#models/media_request'
import ServiceInstance from '#models/service_instance'
import NotificationService from '#services/notification_service'
import RadarrClient from '#services/radarr_client'
import SonarrClient from '#services/sonarr_client'
import logger from '@adonisjs/core/services/logger'

export interface DownloadStatus {
  status: 'queued' | 'downloading' | 'completed' | 'failed'
  progress?: number
  estimatedTime?: string
  quality?: string
  size?: string
}

export default class DownloadTracker {
  constructor(
    private radarrClient: RadarrClient = new RadarrClient(),
    private sonarrClient: SonarrClient = new SonarrClient(),
    private notifications: NotificationService = new NotificationService()
  ) {}

  async dispatch(request: MediaRequest): Promise<void> {
    const instance = request.serviceInstanceId
      ? await ServiceInstance.query()
          .where('id', request.serviceInstanceId)
          .where('is_active', true)
          .first()
      : await ServiceInstance.query()
          .apply((scopes) => scopes.default())
          .where('type', request.mediaType === 'movie' ? 'radarr' : 'sonarr')
          .first()

    if (!instance) {
      throw new Error(`No active default ${request.mediaType === 'movie' ? 'Radarr' : 'Sonarr'} instance found`)
    }

    if (request.mediaType === 'movie') {
      const movie = await this.radarrClient.addMovie(instance, request.tmdbId, request.title)
      request.externalId = movie.id
    } else {
      const series = await this.sonarrClient.addSeries(
        instance,
        request.tmdbId,
        request.title,
        request.seasons || undefined
      )
      request.externalId = series.id
    }

    request.serviceInstanceId = instance.id
    request.status = 'downloading'
    await request.save()

    await this.notifications.notify(
      request.userId,
      'request_dispatched',
      'Demande approuvee',
      `Votre demande "${request.title}" a ete envoyee au telechargement.`
    )
  }

  async checkStatus(request: MediaRequest): Promise<DownloadStatus> {
    if (!request.serviceInstanceId || !request.externalId) {
      return { status: 'failed' }
    }

    const instance = await ServiceInstance.find(request.serviceInstanceId)
    if (!instance || !instance.isActive) {
      return { status: 'failed' }
    }

    if (request.mediaType === 'movie') {
      const movie = await this.radarrClient.getMovie(instance, request.externalId)
      const queue = await this.radarrClient.getQueue(instance)
      const queueItem = queue.find((item) => item.movieId === request.externalId)

      if (movie.hasFile) {
        return {
          status: 'completed',
          quality: movie.movieFile?.quality?.quality?.name,
          size: movie.movieFile?.size ? `${Math.round(movie.movieFile.size / 1024 / 1024)} MB` : undefined,
        }
      }

      if (queueItem) {
        const size = queueItem.size || 0
        const left = queueItem.sizeleft || 0
        const progress = size > 0 ? Math.max(0, Math.min(100, Math.round(((size - left) / size) * 100))) : undefined

        return {
          status: queueItem.status === 'downloading' ? 'downloading' : 'queued',
          progress,
          estimatedTime: queueItem.timeleft,
          quality: queueItem.quality?.quality?.name,
          size: size > 0 ? `${Math.round(size / 1024 / 1024)} MB` : undefined,
        }
      }

      return { status: 'queued' }
    }

    const series = await this.sonarrClient.getSeries(instance, request.externalId)
    const queue = await this.sonarrClient.getQueue(instance)
    const queueItem = queue.find((item) => item.seriesId === request.externalId)

    if ((series.statistics?.percentOfEpisodes || 0) >= 100) {
      return { status: 'completed' }
    }

    if (queueItem) {
      const size = queueItem.size || 0
      const left = queueItem.sizeleft || 0
      const progress = size > 0 ? Math.max(0, Math.min(100, Math.round(((size - left) / size) * 100))) : undefined

      return {
        status: queueItem.status === 'downloading' ? 'downloading' : 'queued',
        progress,
        estimatedTime: queueItem.timeleft,
        quality: queueItem.quality?.quality?.name,
        size: size > 0 ? `${Math.round(size / 1024 / 1024)} MB` : undefined,
      }
    }

    return { status: 'queued' }
  }

  async syncAll(): Promise<void> {
    const activeRequests = await MediaRequest.query().whereIn('status', ['approved', 'downloading'])

    for (const request of activeRequests) {
      try {
        const status = await this.checkStatus(request)

        if (status.status === 'completed') {
          request.status = 'available'
          await request.save()

          await this.notifications.notify(
            request.userId,
            'download_completed',
            'Media disponible',
            `Votre demande "${request.title}" est maintenant disponible.`
          )
        } else if (status.status === 'downloading' && request.status !== 'downloading') {
          request.status = 'downloading'
          await request.save()
        }
      } catch (error) {
        logger.error({ error, requestId: request.id }, 'Failed to sync media request status')
      }
    }
  }
}
