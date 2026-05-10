import type User from '#models/user'
import type MediaRequest from '#models/media_request'

export interface NotificationPayload {
  event: 'request.created' | 'request.approved' | 'request.rejected' | 'media.available'
  title: string
  message: string
  user?: User
  request?: MediaRequest
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<void>
}
