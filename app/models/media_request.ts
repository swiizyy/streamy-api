import ServiceInstance from '#models/service_instance'
import User from '#models/user'
import {
  BaseModel,
  belongsTo,
  column,
} from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export type MediaType = 'movie' | 'tv'
export type MediaRequestStatus = 'pending' | 'approved' | 'declined' | 'downloading' | 'available'

export default class MediaRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare tmdbId: number

  @column()
  declare mediaType: MediaType

  @column()
  declare title: string

  @column()
  declare status: MediaRequestStatus

  @column()
  declare serviceInstanceId: number | null

  @column()
  declare externalId: number | null

  @column.dateTime()
  declare requestedAt: DateTime

  @column()
  declare respondedBy: number | null

  @column.dateTime()
  declare respondedAt: DateTime | null

  @column()
  declare seasons: number[] | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'respondedBy' })
  declare responder: BelongsTo<typeof User>

  @belongsTo(() => ServiceInstance)
  declare serviceInstance: BelongsTo<typeof ServiceInstance>
}
