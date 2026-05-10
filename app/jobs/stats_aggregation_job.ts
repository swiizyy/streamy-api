import JellyfinStatsService from '#streamystats/services/jellyfin_stats_service'
import logger from '@adonisjs/core/services/logger'

export default class StatsAggregationJob {
  async run(): Promise<void> {
    logger.info('Stats aggregation job started')
    const service = new JellyfinStatsService()

    await service.syncSessions()
    await service.syncUserHistories()

    logger.info('Stats aggregation job completed')
  }
}
