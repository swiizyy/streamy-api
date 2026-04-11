import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'watch_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()

      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('jellyfin_item_id').notNullable()
      table.string('jellyfin_session_id').nullable()
      table.string('title').notNullable()
      table.string('play_method').notNullable()
      table.string('client_name').notNullable()
      table.string('device_name').notNullable()
      table.timestamp('started_at').notNullable()
      table.timestamp('ended_at').nullable()
      table.bigInteger('paused_duration_ticks').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'jellyfin_item_id'])
      table.index(['jellyfin_session_id'])
      table.index(['started_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
