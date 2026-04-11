import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('code', 20).notNullable().unique()

      table
        .bigInteger('created_by')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('label').nullable()
      table.integer('max_uses').nullable()
      table.integer('remaining_uses').nullable()
      table.integer('account_expiry_days').nullable()
      table.json('allowed_libraries').nullable()
      table.integer('max_streams').nullable()
      table.timestamp('expires_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['created_by'])
      table.index(['is_active'])
      table.index(['expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
