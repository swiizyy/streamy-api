import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'referrals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()

      table
        .bigInteger('invite_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('invites')
        .onDelete('CASCADE')

      table
        .bigInteger('sponsor_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table
        .bigInteger('referred_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.string('jellyfin_user_id').notNullable()
      table.timestamp('account_expires_at').nullable()
      table.enum('status', ['active', 'expired', 'revoked']).notNullable().defaultTo('active')
      table.boolean('notified_expiry').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()

      table.unique(['referred_user_id'])
      table.index(['sponsor_id'])
      table.index(['status'])
      table.index(['account_expires_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
