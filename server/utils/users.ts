import type { User } from '#shared/types'

export { ROLE_LABEL } from '#shared/constants'

/** The user fields the admin UI receives (allow-list). Credentials live elsewhere and never pass through here. */
export function publicUser(u: User): User {
  const { id, name, email, role, status, lastLogin, lockedUntil, mustChangePassword } = u
  return { id, name, email, role, status, lastLogin, lockedUntil, mustChangePassword: !!mustChangePassword }
}
