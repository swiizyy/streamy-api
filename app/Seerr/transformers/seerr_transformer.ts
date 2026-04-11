import type MediaRequest from '#models/media_request'
import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { getPermissions } from '../helpers/permissions.js'

/**
 * Numeric request status values used by the Seerr API contract.
 *
 * Overseerr / Jellyseerr clients expect integer status codes rather than
 * the string-based statuses used internally by StreamyAPI.
 */
export const SeerrRequestStatus = {
  PENDING: 1,
  APPROVED: 2,
  DECLINED: 3,
  AVAILABLE: 4,
  DOWNLOADING: 5,
} as const

/**
 * Numeric media type values used by the Seerr API contract.
 */
export const SeerrMediaType = {
  MOVIE: 1,
  TV: 2,
} as const

function toSeerrStatus(status: MediaRequest['status']): number {
  switch (status) {
    case 'pending':
      return SeerrRequestStatus.PENDING
    case 'approved':
      return SeerrRequestStatus.APPROVED
    case 'declined':
      return SeerrRequestStatus.DECLINED
    case 'available':
      return SeerrRequestStatus.AVAILABLE
    case 'downloading':
      return SeerrRequestStatus.DOWNLOADING
    default:
      return SeerrRequestStatus.PENDING
  }
}

function toSeerrMediaType(mediaType: MediaRequest['mediaType']): number {
  return mediaType === 'movie' ? SeerrMediaType.MOVIE : SeerrMediaType.TV
}

/**
 * Transforms a StreamyAPI `MediaRequest` into the camelCase, numerically-typed
 * format expected by Seerr-compatible clients (e.g. Streamyfin).
 *
 * Place transformers in `app/Seerr/transformers/` to co-locate data contracts
 * with the domain that owns them (Romain Lanz / feature-based architecture).
 */
export default class SeerrTransformer extends BaseTransformer<MediaRequest> {
  toObject() {
    const request = this.resource

    return {
      id: request.id,
      status: toSeerrStatus(request.status),
      type: request.mediaType,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      requestedBy: this.when(!!(request as any).user, () =>
        SeerrUserTransformer.transform((request as any).user as User)
      ),
      media: {
        mediaType: toSeerrMediaType(request.mediaType),
        tmdbId: request.tmdbId,
        title: request.title,
        seasons: request.seasons,
      },
    }
  }
}

/**
 * Lightweight user representation used inside Seerr-format responses.
 * Returns only the fields expected by Seerr-compatible clients.
 */
export class SeerrUserTransformer extends BaseTransformer<User> {
  toObject() {
    const user = this.resource

    return {
      id: user.id,
      displayName: user.username,
      email: user.email,
      avatar: user.avatarUrl,
      permissions: getPermissions(user.role),
      userType: 1 as const,
    }
  }
}
