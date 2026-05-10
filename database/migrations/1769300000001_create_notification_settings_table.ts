import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notification_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.boolean('smtp_enabled').notNullable().defaultTo(false)
      table.boolean('discord_enabled').notNullable().defaultTo(false)
      table.boolean('slack_enabled').notNullable().defaultTo(false)
      table.boolean('ntfy_enabled').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // Seed a single default row so the app always has settings
    this.defer(async (db) => {
      await db.table(this.tableName).insert({
        smtp_enabled: false,
        discord_enabled: false,
        slack_enabled: false,
        ntfy_enabled: false,
        created_at: new Date().toISOString(),
      })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
