import env from '#start/env'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import StatsAggregationJob from '#jobs/stats_aggregation_job'

const isAceCommand = process.argv.some((arg) => arg.includes('ace'))

if (!app.inTest && !isAceCommand) {
  const redisHost = env.get('REDIS_HOST')

  if (redisHost) {
    // BullMQ scheduler when Redis is available
    import('bullmq').then(({ Queue, Worker }) => {
      const connection = {
        host: redisHost,
        port: env.get('REDIS_PORT') || 6379,
      }

      const queue = new Queue('stats-sync', { connection })

      // Schedule repeating job every 5 minutes
      queue
        .add('sync', {}, { repeat: { every: 5 * 60 * 1000 } })
        .catch((e) => logger.warn({ e }, 'Failed to schedule stats-sync job'))

      const worker = new Worker(
        'stats-sync',
        async () => {
          const job = new StatsAggregationJob()
          await job.run()
        },
        { connection }
      )

      worker.on('failed', (_, err) => logger.error({ err }, 'stats-sync worker failed'))
      logger.info('BullMQ stats-sync scheduler started')
    })
  } else {
    // Fallback: plain interval when Redis is not configured
    const job = new StatsAggregationJob()
    const interval = setInterval(() => {
      void job.run().catch((e) => logger.warn({ e }, 'Stats aggregation error'))
    }, 5 * 60 * 1000)

    interval.unref()
    logger.debug('Stats sync scheduled via setInterval (no Redis configured)')
  }
}
