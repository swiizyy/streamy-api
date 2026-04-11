import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

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

      table.string('type').notNullable()
      table.string('title').notNullable()
      table.text('message').notNullable()
      table.boolean('read').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()

      table.index(['user_id', 'read'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
