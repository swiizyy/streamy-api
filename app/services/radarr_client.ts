import ServiceInstance from '#models/service_instance'
import logger from '@adonisjs/core/services/logger'
import type {
  RadarrMovie,
  RadarrProfile,
  RadarrQueueItem,
  RadarrRootFolder,
  RadarrStatus,
} from '#services/radarr_types'

export default class RadarrClient {
  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '')
  }

  private buildUrl(instance: ServiceInstance, endpoint: string, params: Record<string, any> = {}) {
    const query = new URLSearchParams({
      apikey: instance.apiKey,
      ...Object.fromEntries(Object.entries(params).filter(([_, value]) => value !== undefined)),
    })

    return `${this.normalizeUrl(instance.url)}${endpoint}?${query.toString()}`
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init)

    if (!response.ok) {
      const body = await response.text().catch(() => 'Unknown error')
      logger.error({ status: response.status, body }, 'Radarr API error')
      throw new Error(`Radarr API error: ${response.status} - ${body}`)
    }

    return response.json() as Promise<T>
  }

  async testConnection(instance: ServiceInstance): Promise<boolean> {
    const url = this.buildUrl(instance, '/api/v3/system/status')
    await this.request<RadarrStatus>(url)
    return true
  }

  async getSystemStatus(instance: ServiceInstance): Promise<RadarrStatus> {
    const url = this.buildUrl(instance, '/api/v3/system/status')
    return this.request<RadarrStatus>(url)
  }

  async getQualityProfiles(instance: ServiceInstance): Promise<RadarrProfile[]> {
    const url = this.buildUrl(instance, '/api/v3/qualityprofile')
    return this.request<RadarrProfile[]>(url)
  }

  async getRootFolders(instance: ServiceInstance): Promise<RadarrRootFolder[]> {
    const url = this.buildUrl(instance, '/api/v3/rootfolder')
    return this.request<RadarrRootFolder[]>(url)
  }

  async addMovie(instance: ServiceInstance, tmdbId: number, title: string): Promise<RadarrMovie> {
    const url = this.buildUrl(instance, '/api/v3/movie')

    return this.request<RadarrMovie>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tmdbId,
        title,
        qualityProfileId: instance.qualityProfileId,
        rootFolderPath: instance.rootFolder,
        monitored: true,
        addOptions: {
          searchForMovie: true,
        },
      }),
    })
  }

  async getMovie(instance: ServiceInstance, radarrId: number): Promise<RadarrMovie> {
    const url = this.buildUrl(instance, `/api/v3/movie/${radarrId}`)
    return this.request<RadarrMovie>(url)
  }

  async getQueue(instance: ServiceInstance): Promise<RadarrQueueItem[]> {
    const url = this.buildUrl(instance, '/api/v3/queue')
    const response = await this.request<{ records: RadarrQueueItem[] }>(url)
    return response.records || []
  }
}
