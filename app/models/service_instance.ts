import MediaRequest from '#models/media_request'
import { BaseModel, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export type ServiceInstanceType = 'radarr' | 'sonarr'

export default class ServiceInstance extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare type: ServiceInstanceType

  @column()
  declare url: string

  @column({ serializeAs: null })
  declare apiKey: string

  @column()
  declare rootFolder: string

  @column()
  declare qualityProfileId: number

  @column()
  declare isDefault: boolean

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @hasMany(() => MediaRequest)
  declare mediaRequests: HasMany<typeof MediaRequest>

  static default = scope((query) => {
    query.where('is_default', true).andWhere('is_active', true)
  })
}
