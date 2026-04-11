import ServiceInstance from '#models/service_instance'
import RadarrClient from '#services/radarr_client'
import SonarrClient from '#services/sonarr_client'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

const serviceStoreValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1),
    type: vine.enum(['radarr', 'sonarr'] as const),
    url: vine.string().trim().url(),
    api_key: vine.string().trim().minLength(1),
    root_folder: vine.string().trim().minLength(1),
    quality_profile_id: vine.number(),
    is_default: vine.boolean().optional(),
  })
)

const serviceUpdateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).optional(),
    url: vine.string().trim().url().optional(),
    api_key: vine.string().trim().minLength(1).optional(),
    root_folder: vine.string().trim().minLength(1).optional(),
    quality_profile_id: vine.number().optional(),
    is_default: vine.boolean().optional(),
    is_active: vine.boolean().optional(),
  })
)

@inject()
export default class ServicesController {
  constructor(
    private radarr: RadarrClient,
    private sonarr: SonarrClient
  ) {}

  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(serviceStoreValidator)

    if (payload.is_default) {
      await ServiceInstance.query().where('type', payload.type).update({ isDefault: false })
    }

    const instance = await ServiceInstance.create({
      name: payload.name,
      type: payload.type,
      url: payload.url,
      apiKey: payload.api_key,
      rootFolder: payload.root_folder,
      qualityProfileId: payload.quality_profile_id,
      isDefault: payload.is_default ?? false,
      isActive: true,
    })

    return response.created(instance)
  }

  async index() {
    return ServiceInstance.query().orderBy('created_at', 'desc')
  }

  async update({ params, request }: HttpContext) {
    const instance = await ServiceInstance.findOrFail(params.id)
    const payload = await request.validateUsing(serviceUpdateValidator)

    if (payload.is_default) {
      await ServiceInstance.query()
        .where('type', instance.type)
        .whereNot('id', instance.id)
        .update({ isDefault: false })
    }

    instance.merge({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.url !== undefined && { url: payload.url }),
      ...(payload.api_key !== undefined && { apiKey: payload.api_key }),
      ...(payload.root_folder !== undefined && { rootFolder: payload.root_folder }),
      ...(payload.quality_profile_id !== undefined && { qualityProfileId: payload.quality_profile_id }),
      ...(payload.is_default !== undefined && { isDefault: payload.is_default }),
      ...(payload.is_active !== undefined && { isActive: payload.is_active }),
    })

    await instance.save()
    return instance
  }

  async destroy({ params, response }: HttpContext) {
    const instance = await ServiceInstance.findOrFail(params.id)
    instance.isActive = false
    instance.isDefault = false
    await instance.save()

    return response.noContent()
  }

  async test({ params }: HttpContext) {
    const instance = await ServiceInstance.findOrFail(params.id)

    try {
      const status =
        instance.type === 'radarr'
          ? await this.radarr.getSystemStatus(instance)
          : await this.sonarr.getSystemStatus(instance)

      return {
        success: true,
        version: status.version || 'unknown',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async profiles({ params }: HttpContext) {
    const instance = await ServiceInstance.findOrFail(params.id)

    return instance.type === 'radarr'
      ? this.radarr.getQualityProfiles(instance)
      : this.sonarr.getQualityProfiles(instance)
  }

  async rootFolders({ params }: HttpContext) {
    const instance = await ServiceInstance.findOrFail(params.id)

    return instance.type === 'radarr'
      ? this.radarr.getRootFolders(instance)
      : this.sonarr.getRootFolders(instance)
  }
}
