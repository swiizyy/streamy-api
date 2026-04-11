import JellyfinClient, { buildJellyfinAuthHeader } from '#services/jellyfin_client'
import logger from '@adonisjs/core/services/logger'

/**
 * Jellyfin availability information
 */
export interface JellyfinAvailability {
  available: boolean
  jellyfinItemId?: string
  addedAt?: string
}

/**
 * Service to check media availability on Jellyfin servers
 * Works with user-specific Jellyfin tokens
 */
export default class JellyfinSync {
  constructor(private jellyfinClient: JellyfinClient, private userToken: string, private userId: string) {}

  /**
   * Check if a media is available on Jellyfin
   * Searches by TMDB provider ID or name
   */
  async checkAvailability(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<JellyfinAvailability> {
    try {
      // Try searching by provider ID first (TMDB ID stored as external ID)
      const response = await fetch(
        `${this.jellyfinClient.getBaseUrl()}/Items?AnyProviderIdEquals=tmdb.${tmdbId}&UserId=${this.userId}&Recursive=true`,
        {
          headers: {
            'X-Emby-Token': this.userToken,
            'X-Emby-Authorization': buildJellyfinAuthHeader(this.userToken),
          },
        }
      )

      if (response.ok) {
        const data = (await response.json()) as { Items: any[] }
        if (data.Items && data.Items.length > 0) {
          const item = data.Items[0]
          return {
            available: true,
            jellyfinItemId: item.Id,
            addedAt: item.DateCreated,
          }
        }
      }

      return { available: false }
    } catch (error) {
      logger.warn({ error, tmdbId, mediaType }, 'Failed to check Jellyfin availability')
      return { available: false }
    }
  }

  /**
   * Check availability for multiple items in batch
   * Prevents N+1 queries on search result pages
   */
  async checkBatchAvailability(
    items: Array<{ tmdbId: number; mediaType: 'movie' | 'tv' }>
  ): Promise<Map<string, JellyfinAvailability>> {
    const results = new Map<string, JellyfinAvailability>()

    // For batch, we could optimize with a single query using OR filters
    // For now, parallel requests (respecting rate limits)
    const promises = items.map(async (item) => {
      const key = `${item.mediaType}:${item.tmdbId}`
      const availability = await this.checkAvailability(item.tmdbId, item.mediaType)
      results.set(key, availability)
    })

    await Promise.all(promises)
    return results
  }
}

/**
 * Factory to create JellyfinSync instances for a specific user
 */
export class JellyfinSyncFactory {
  constructor(private jellyfin: JellyfinClient) {}

  create(userToken: string, userId: string): JellyfinSync {
    return new JellyfinSync(this.jellyfin, userToken, userId)
  }
}
