import type { UserRole } from '#models/user'

/**
 * Seerr-compatible permission bitmask constants.
 *
 * Mirrors the permission model used by Overseerr / Jellyseerr so that
 * compatible clients (Streamyfin, etc.) can interpret the `permissions`
 * field on user objects without modification.
 */
export const Permission = {
  /** No permissions. */
  NONE: 0,

  /** User can submit new media requests. */
  REQUEST: 2,

  /** User can approve or decline requests. */
  MANAGE_REQUESTS: 4,

  /** User can view other users' requests and statistics. */
  VIEW_REQUESTS: 8,

  /** User has full administrative access. Implies all other permissions. */
  ADMIN: 2048,
} as const

export type PermissionFlag = (typeof Permission)[keyof typeof Permission]

/**
 * Compute the Seerr permission bitmask for a given StreamyAPI user role.
 *
 * - `admin`     → ADMIN | MANAGE_REQUESTS | REQUEST | VIEW_REQUESTS
 * - `user`      → REQUEST | VIEW_REQUESTS
 * - `requester` → REQUEST only
 */
export function getPermissions(role: UserRole): number {
  switch (role) {
    case 'admin':
      return (
        Permission.ADMIN |
        Permission.MANAGE_REQUESTS |
        Permission.REQUEST |
        Permission.VIEW_REQUESTS
      )
    case 'user':
      return Permission.REQUEST | Permission.VIEW_REQUESTS
    case 'requester':
      return Permission.REQUEST
    default:
      return Permission.NONE
  }
}

/**
 * Returns true when the given bitmask includes all bits of `flag`.
 */
export function hasPermission(bitmask: number, flag: PermissionFlag): boolean {
  return (bitmask & flag) === flag
}
