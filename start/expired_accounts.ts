import app from '@adonisjs/core/services/app'
import ExpiredAccountsJob from '#jobs/expired_accounts_job'

const isAceCommand = process.argv.some((arg) => arg.includes('ace'))

if (!app.inTest && !isAceCommand) {
  const job = new ExpiredAccountsJob()

  const interval = setInterval(() => {
    void job.run()
  }, 60 * 60 * 1000)

  interval.unref()
}
