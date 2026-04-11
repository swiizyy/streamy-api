import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_instances'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').notNullable()
      table.string('name').notNullable()
      table.enum('type', ['radarr', 'sonarr']).notNullable()
      table.string('url').notNullable()
      table.string('api_key').notNullable()
      table.string('root_folder').notNullable()
      table.integer('quality_profile_id').notNullable()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.boolean('is_active').notNullable().defaultTo(true)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['type', 'is_default', 'is_active'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
