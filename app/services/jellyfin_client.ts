import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { JellyfinAuthResponse, JellyfinUser } from '#services/jellyfin_types'

const CLIENT_INFO = {
  Client: 'StreamyAPI',
  Device: 'StreamyAPI-Server',
  DeviceId: 'streamy-api-server-001',
  Version: '1.0.0',
}

function buildAuthHeader(token?: string): string {
  const parts = [
    `MediaBrowser Client="${CLIENT_INFO.Client}"`,
    `Device="${CLIENT_INFO.Device}"`,
    `DeviceId="${CLIENT_INFO.DeviceId}"`,
    `Version="${CLIENT_INFO.Version}"`,
  ]
  if (token) {
    parts.push(`Token="${token}"`)
  }
  return parts.join(', ')
}

export function buildJellyfinAuthHeader(token?: string): string {
  return buildAuthHeader(token)
}

export default class JellyfinClient {
  protected baseUrl: string
  protected apiKey: string

  constructor() {
    this.baseUrl = env.get('JELLYFIN_URL').replace(/\/$/, '')
    this.apiKey = env.get('JELLYFIN_API_KEY')
  }

  /**
   * Get the base URL of the Jellyfin server
   */
  getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Authenticate a user with username/password against Jellyfin.
   * POST {baseUrl}/Users/AuthenticateByName
   */
  async authenticate(username: string, password: string): Promise<JellyfinAuthResponse> {
    const url = `${this.baseUrl}/Users/AuthenticateByName`

    logger.debug({ url, username }, 'Authenticating user against Jellyfin')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': buildAuthHeader(),
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    })

    if (!response.ok) {
      logger.warn({ status: response.status, username }, 'Jellyfin authentication failed')
      throw new Error(`Jellyfin authentication failed with status ${response.status}`)
    }

    return response.json() as Promise<JellyfinAuthResponse>
  }

  /**
   * Fetch a Jellyfin user profile.
   * GET {baseUrl}/Users/{userId}
   */
  async getUser(jellyfinUserId: string, token: string): Promise<JellyfinUser> {
    const url = `${this.baseUrl}/Users/${jellyfinUserId}`

    const response = await fetch(url, {
      headers: {
        'X-Emby-Token': token,
        'X-Emby-Authorization': buildAuthHeader(token),
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Jellyfin user ${jellyfinUserId}: ${response.status}`)
    }

    return response.json() as Promise<JellyfinUser>
  }

  /**
   * Check whether a Jellyfin user has the administrator role.
   */
  async isAdmin(jellyfinUserId: string, token: string): Promise<boolean> {
    const user = await this.getUser(jellyfinUserId, token)
    return user.Policy.IsAdministrator
  }
}
