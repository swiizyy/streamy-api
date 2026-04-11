import logger from '@adonisjs/core/services/logger'

export default class StatsAggregationJob {
  async run(): Promise<void> {
    // Placeholder for daily pre-aggregation if query load increases.
    logger.debug('Stats aggregation job placeholder executed')
  }
}
