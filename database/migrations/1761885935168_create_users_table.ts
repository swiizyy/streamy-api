import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('jellyfin_id').notNullable().unique()
      table.string('username').notNullable()
      table.string('email').nullable()
      table.string('avatar_url').nullable()
      table.enum('role', ['admin', 'user', 'requester']).notNullable().defaultTo('user')
      table.string('jellyfin_token').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
