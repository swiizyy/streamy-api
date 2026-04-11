export interface SonarrProfile {
  id: number
  name: string
}

export interface SonarrRootFolder {
  id: number
  path: string
  accessible?: boolean
}

export interface SonarrSeriesLookupResult {
  tvdbId?: number
  tmdbId?: number
  title: string
  year?: number
}

export interface SonarrSeries {
  id: number
  tvdbId?: number
  title: string
  status?: string
  monitored?: boolean
  statistics?: {
    percentOfEpisodes?: number
    episodeFileCount?: number
  }
}

export interface SonarrQueueItem {
  id: number
  seriesId?: number
  status?: string
  trackedDownloadStatus?: string
  quality?: {
    quality?: {
      name?: string
    }
  }
  size?: number
  sizeleft?: number
  timeleft?: string
}

export interface SonarrStatus {
  version?: string
}
