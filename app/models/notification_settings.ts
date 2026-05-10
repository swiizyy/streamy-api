import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class NotificationSettings extends BaseModel {
  static table = 'notification_settings'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare smtpEnabled: boolean

  @column()
  declare discordEnabled: boolean

  @column()
  declare slackEnabled: boolean

  @column()
  declare ntfyEnabled: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static async getSettings(): Promise<NotificationSettings> {
    const settings = await NotificationSettings.first()
    if (settings) return settings
    return NotificationSettings.create({
      smtpEnabled: false,
      discordEnabled: false,
      slackEnabled: false,
      ntfyEnabled: false,
    })
  }
}
