import Referral from '#models/referral'
import User from '#models/user'
import { BaseModel, beforeCreate, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { customAlphabet } from 'nanoid'
import { DateTime } from 'luxon'

const codeGenerator = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 10)

export default class Invite extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare createdBy: number

  @column()
  declare label: string | null

  @column()
  declare maxUses: number | null

  @column()
  declare remainingUses: number | null

  @column()
  declare accountExpiryDays: number | null

  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: string | string[] | null) => {
      if (!value) return null
      if (Array.isArray(value)) return value
      try {
        return JSON.parse(value) as string[]
      } catch {
        return null
      }
    },
  })
  declare allowedLibraries: string[] | null

  @column()
  declare maxStreams: number | null

  @column.dateTime()
  declare expiresAt: DateTime | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => Referral)
  declare referrals: HasMany<typeof Referral>

  @beforeCreate()
  static assignCode(invite: Invite) {
    if (!invite.code) {
      invite.code = codeGenerator()
    }
  }

  isValid(): boolean {
    if (!this.isActive) {
      return false
    }

    if (this.expiresAt && this.expiresAt <= DateTime.now()) {
      return false
    }

    if (typeof this.remainingUses === 'number' && this.remainingUses <= 0) {
      return false
    }

    return true
  }
}
