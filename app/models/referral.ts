import Invite from '#models/invite'
import User from '#models/user'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export type ReferralStatus = 'active' | 'expired' | 'revoked'

export default class Referral extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare inviteId: number

  @column()
  declare sponsorId: number

  @column()
  declare referredUserId: number

  @column()
  declare jellyfinUserId: string

  @column.dateTime()
  declare accountExpiresAt: DateTime | null

  @column()
  declare status: ReferralStatus

  @column()
  declare notifiedExpiry: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Invite)
  declare invite: BelongsTo<typeof Invite>

  @belongsTo(() => User, { foreignKey: 'sponsorId' })
  declare sponsor: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'referredUserId' })
  declare referredUser: BelongsTo<typeof User>
}
