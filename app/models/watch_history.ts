import User from '#models/user'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export type WatchMediaType = 'movie' | 'episode'

export default class WatchHistory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare jellyfinItemId: string

  @column()
  declare mediaType: WatchMediaType

  @column()
  declare title: string

  @column()
  declare seriesName: string | null

  @column()
  declare seasonNumber: number | null

  @column()
  declare episodeNumber: number | null

  @column()
  declare durationTicks: number

  @column()
  declare playedTicks: number

  @column()
  declare percentPlayed: number

  @column.dateTime()
  declare watchedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
