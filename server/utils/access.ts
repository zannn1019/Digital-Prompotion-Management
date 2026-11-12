import type { Role, User } from '#shared/types'

// Who may call an admin route. Pure logic, no auto-imports, so tests can use it.

/** Message for a user who still has a temporary password. */
export const MUST_CHANGE_PASSWORD = 'Ganti kata sandi sementara Anda terlebih dahulu.'

export interface AccessDenial {
  statusCode: 401 | 403
  statusMessage: string
  data?: { mustChangePassword: true }
}

/**
 * Null when the user may go on. Someone signed in with a temporary password can only change it:
 * every other route answers 403 until they do (`allowPasswordChange` is for the change route itself).
 */
export function accessDenial(user: User | null, role?: Role, opts: { allowPasswordChange?: boolean } = {}): AccessDenial | null {
  if (!user) return { statusCode: 401, statusMessage: 'Silakan masuk terlebih dahulu.' }
  if (user.mustChangePassword && !opts.allowPasswordChange)
    return { statusCode: 403, statusMessage: MUST_CHANGE_PASSWORD, data: { mustChangePassword: true } }
  if (role === 'super' && user.role !== 'super') return { statusCode: 403, statusMessage: 'Halaman ini khusus Super Admin.' }
  return null
}
