import MediaRequest from '#models/media_request'
import ServiceInstance from '#models/service_instance'
import DownloadTracker from '#services/download_tracker'
import RadarrClient from '#services/radarr_client'
import SonarrClient from '#services/sonarr_client'
import type { RadarrQueueItem } from '#services/radarr_types'
import type { SonarrQueueItem } from '#services/sonarr_types'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class DownloadsController {
  constructor(
    private tracker: DownloadTracker,
    private radarrClient: RadarrClient,
    private sonarrClient: SonarrClient
  ) {}

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const mediaRequest = await MediaRequest.query().where('id', params.id).firstOrFail()

    if (user.role !== 'admin' && mediaRequest.userId !== user.id) {
      return response.forbidden({ message: 'Insufficient permissions' })
    }

    const status = await this.tracker.checkStatus(mediaRequest)
    return status
  }

  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.role !== 'admin') {
      return response.forbidden({ message: 'Admin role required' })
    }

    const instances = await ServiceInstance.query().where('is_active', true)
    const result: any[] = []

    for (const instance of instances) {
      let queue: RadarrQueueItem[] | SonarrQueueItem[]
      if (instance.type === 'radarr') {
        queue = await this.radarrClient.getQueue(instance)
      } else {
        queue = await this.sonarrClient.getQueue(instance)
      }
      for (const item of queue) {
        let externalId: number | undefined
        if (instance.type === 'radarr') {
          externalId = (item as RadarrQueueItem).movieId
        } else {
          externalId = (item as SonarrQueueItem).seriesId
        }
        const linkedRequest = externalId
          ? await MediaRequest.query()
              .where('service_instance_id', instance.id)
              .where('external_id', externalId)
              .first()
          : null

        result.push({
          service_instance_id: instance.id,
          service_name: instance.name,
          service_type: instance.type,
          queue_item: item,
          request: linkedRequest,
        })
      }
    }

    return result
  }
}
