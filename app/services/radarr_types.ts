export interface RadarrProfile {
  id: number
  name: string
}

export interface RadarrRootFolder {
  id: number
  path: string
  accessible?: boolean
}

export interface RadarrMovie {
  id: number
  tmdbId?: number
  title: string
  hasFile?: boolean
  monitored?: boolean
  movieFile?: {
    quality?: {
      quality?: {
        name?: string
      }
    }
    size?: number
  }
  status?: string
}

export interface RadarrQueueItem {
  id: number
  movieId?: number
  status?: string
  trackedDownloadStatus?: string
  statusMessages?: Array<{ title?: string; messages?: string[] }>
  protocol?: string
  quality?: {
    quality?: {
      name?: string
    }
  }
  size?: number
  sizeleft?: number
  timeleft?: string
}

export interface RadarrStatus {
  version?: string
}
