import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { JellyfinLibrary, JellyfinUser, JellyfinUserPolicy } from '#services/jellyfin_types'

export default class JellyfinAccountManager {
  protected baseUrl: string
  protected apiKey: string

  constructor() {
    this.baseUrl = env.get('JELLYFIN_URL').replace(/\/$/, '')
    this.apiKey = env.get('JELLYFIN_API_KEY')
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Token': this.apiKey,
        ...(init.headers || {}),
      },
    })

    if (!response.ok) {
      const body = await response.text()
      logger.warn({ status: response.status, path, body }, 'Jellyfin admin API request failed')
      throw new Error(`Jellyfin admin API request failed: ${response.status}`)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  async createUser(username: string, password: string): Promise<JellyfinUser> {
    return this.request<JellyfinUser>('/Users/New', {
      method: 'POST',
      body: JSON.stringify({ Name: username, Password: password }),
    })
  }

  async applyPolicy(jellyfinUserId: string, policy: JellyfinUserPolicy): Promise<void> {
    await this.request<void>(`/Users/${jellyfinUserId}/Policy`, {
      method: 'POST',
      body: JSON.stringify(policy),
    })
  }

  private async getUser(jellyfinUserId: string): Promise<JellyfinUser> {
    return this.request<JellyfinUser>(`/Users/${jellyfinUserId}`)
  }

  async setAllowedLibraries(jellyfinUserId: string, libraryIds: string[]): Promise<void> {
    const currentUser = await this.getUser(jellyfinUserId)
    const updatedPolicy: JellyfinUserPolicy = {
      ...currentUser.Policy,
      EnableAllFolders: libraryIds.length === 0,
      EnabledFolders: libraryIds,
    }

    await this.applyPolicy(jellyfinUserId, updatedPolicy)
  }

  async setMaxStreams(jellyfinUserId: string, maxStreams: number): Promise<void> {
    const currentUser = await this.getUser(jellyfinUserId)
    const updatedPolicy: JellyfinUserPolicy = {
      ...currentUser.Policy,
      MaxActiveSessions: maxStreams,
    }

    await this.applyPolicy(jellyfinUserId, updatedPolicy)
  }

  async disableUser(jellyfinUserId: string): Promise<void> {
    const currentUser = await this.getUser(jellyfinUserId)
    await this.applyPolicy(jellyfinUserId, {
      ...currentUser.Policy,
      IsDisabled: true,
    })
  }

  async enableUser(jellyfinUserId: string): Promise<void> {
    const currentUser = await this.getUser(jellyfinUserId)
    await this.applyPolicy(jellyfinUserId, {
      ...currentUser.Policy,
      IsDisabled: false,
    })
  }

  async deleteUser(jellyfinUserId: string): Promise<void> {
    await this.request<void>(`/Users/${jellyfinUserId}`, {
      method: 'DELETE',
    })
  }

  async getLibraries(): Promise<JellyfinLibrary[]> {
    const folders = await this.request<{ ItemId: string; Name: string }[]>('/Library/VirtualFolders')

    return folders.map((folder) => ({
      id: folder.ItemId,
      name: folder.Name,
    }))
  }
}
