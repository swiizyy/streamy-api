import NotificationService from '#services/notification_service'
import type { NotificationPayload } from '#services/notifications/types'
import logger from '@adonisjs/core/services/logger'

export default class SendNotificationJob {
  async run(payload: NotificationPayload): Promise<void> {
    const service = new NotificationService()
    logger.debug({ event: payload.event }, 'SendNotificationJob running')
    await service.broadcast(payload)
  }
}
