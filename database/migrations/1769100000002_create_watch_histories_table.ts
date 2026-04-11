import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'watch_histories'

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
      table.enum('media_type', ['movie', 'episode']).notNullable()
      table.string('title').notNullable()
      table.string('series_name').nullable()
      table.integer('season_number').nullable()
      table.integer('episode_number').nullable()
      table.bigInteger('duration_ticks').notNullable()
      table.bigInteger('played_ticks').notNullable()
      table.float('percent_played').notNullable()
      table.timestamp('watched_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['user_id', 'watched_at'])
      table.index(['jellyfin_item_id'])
      table.index(['watched_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
