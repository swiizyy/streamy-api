import ServiceInstance from '#models/service_instance'
import logger from '@adonisjs/core/services/logger'
import type {
  SonarrProfile,
  SonarrQueueItem,
  SonarrRootFolder,
  SonarrSeries,
  SonarrSeriesLookupResult,
  SonarrStatus,
} from '#services/sonarr_types'

export default class SonarrClient {
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
      logger.error({ status: response.status, body }, 'Sonarr API error')
      throw new Error(`Sonarr API error: ${response.status} - ${body}`)
    }

    return response.json() as Promise<T>
  }

  async testConnection(instance: ServiceInstance): Promise<boolean> {
    const url = this.buildUrl(instance, '/api/v3/system/status')
    await this.request<SonarrStatus>(url)
    return true
  }

  async getSystemStatus(instance: ServiceInstance): Promise<SonarrStatus> {
    const url = this.buildUrl(instance, '/api/v3/system/status')
    return this.request<SonarrStatus>(url)
  }

  async getQualityProfiles(instance: ServiceInstance): Promise<SonarrProfile[]> {
    const url = this.buildUrl(instance, '/api/v3/qualityprofile')
    return this.request<SonarrProfile[]>(url)
  }

  async getRootFolders(instance: ServiceInstance): Promise<SonarrRootFolder[]> {
    const url = this.buildUrl(instance, '/api/v3/rootfolder')
    return this.request<SonarrRootFolder[]>(url)
  }

  private async lookupSeriesByTmdb(
    instance: ServiceInstance,
    tmdbId: number
  ): Promise<SonarrSeriesLookupResult | null> {
    const url = this.buildUrl(instance, '/api/v3/series/lookup', { term: `tmdb:${tmdbId}` })
    const results = await this.request<SonarrSeriesLookupResult[]>(url)
    return results.find((item) => item.tmdbId === tmdbId) || results[0] || null
  }

  async addSeries(
    instance: ServiceInstance,
    tmdbId: number,
    title: string,
    seasons?: number[]
  ): Promise<SonarrSeries> {
    const lookup = await this.lookupSeriesByTmdb(instance, tmdbId)

    if (!lookup?.tvdbId) {
      throw new Error(`Unable to resolve TVDB ID for TMDB ID ${tmdbId}`)
    }

    const url = this.buildUrl(instance, '/api/v3/series')

    return this.request<SonarrSeries>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tvdbId: lookup.tvdbId,
        title,
        qualityProfileId: instance.qualityProfileId,
        rootFolderPath: instance.rootFolder,
        monitored: true,
        seasons: seasons?.map((seasonNumber) => ({ seasonNumber, monitored: true })),
        addOptions: {
          searchForMissingEpisodes: true,
        },
      }),
    })
  }

  async getSeries(instance: ServiceInstance, sonarrId: number): Promise<SonarrSeries> {
    const url = this.buildUrl(instance, `/api/v3/series/${sonarrId}`)
    return this.request<SonarrSeries>(url)
  }

  async getQueue(instance: ServiceInstance): Promise<SonarrQueueItem[]> {
    const url = this.buildUrl(instance, '/api/v3/queue')
    const response = await this.request<{ records: SonarrQueueItem[] }>(url)
    return response.records || []
  }
}
