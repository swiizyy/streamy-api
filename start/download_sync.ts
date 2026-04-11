import env from '#start/env'
import app from '@adonisjs/core/services/app'
import DownloadSyncJob from '#jobs/download_sync_job'

const isAceCommand = process.argv.some((arg) => arg.includes('ace'))

if (!app.inTest && !isAceCommand) {
  const intervalSeconds = env.get('DOWNLOAD_SYNC_INTERVAL_SECONDS') || 60
  const job = new DownloadSyncJob()

  const interval = setInterval(() => {
    void job.run()
  }, intervalSeconds * 1000)

  interval.unref()
}
