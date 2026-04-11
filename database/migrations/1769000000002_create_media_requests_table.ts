import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'media_requests'

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

      table.integer('tmdb_id').notNullable()
      table.enum('media_type', ['movie', 'tv']).notNullable()
      table.string('title').notNullable()
      table
        .enum('status', ['pending', 'approved', 'declined', 'downloading', 'available'])
        .notNullable()
        .defaultTo('pending')

      table
        .bigInteger('service_instance_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('service_instances')
        .onDelete('SET NULL')

      table.integer('external_id').nullable()
      table.timestamp('requested_at').notNullable()

      table
        .bigInteger('responded_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')

      table.timestamp('responded_at').nullable()
      table.json('seasons').nullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['tmdb_id', 'media_type'])
      table.index(['status'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
