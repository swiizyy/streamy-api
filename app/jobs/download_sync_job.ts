import DownloadTracker from '#services/download_tracker'
import logger from '@adonisjs/core/services/logger'

export default class DownloadSyncJob {
  constructor(private tracker: DownloadTracker = new DownloadTracker()) {}

  async run(): Promise<void> {
    try {
      await this.tracker.syncAll()
    } catch (error) {
      logger.error({ error }, 'Download sync job failed')
    }
  }
}
