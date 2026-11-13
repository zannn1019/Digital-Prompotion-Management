import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { Role, User } from '#shared/types'

// Server-side sessions in PostgreSQL: the cookie holds only an unguessable random token, the database
// only its SHA-256 (server/repositories/users.ts). Sessions survive restarts and redeploys.
const COOKIE = 'nfc_session'
const IDLE_MS = 30 * 60 * 1000
/** The sliding expiry is written at most this often, not on every request. */
const EXTEND_AFTER_MS = 60 * 1000

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: !import.meta.dev, path: '/', maxAge: IDLE_MS / 1000 }
}

export async function createSession(event: H3Event, userId: string) {
  // Rotate: drop any session the browser already had.
  await destroySession(event)
  const token = randomBytes(32).toString('base64url')
  await (await useUsers()).createSession(token, userId, new Date(Date.now() + IDLE_MS))
  setCookie(event, COOKIE, token, cookieOptions())
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, COOKIE)
  if (token) await (await useUsers()).deleteSession(token)
  deleteCookie(event, COOKIE, { path: '/' })
}

/** Ends every session of a user, e.g. after deactivation or a password reset. */
export async function destroyUserSessions(userId: string) {
  await (await useUsers()).deleteUserSessions(userId)
}

export async function currentUser(event: H3Event): Promise<User | null> {
  // Looked up once per request, even when several checks ask.
  if (event.context.sessionUser !== undefined) return event.context.sessionUser as User | null
  const token = getCookie(event, COOKIE)
  // Visitors (public poster pages, their images) have no session cookie: no database query for them.
  if (!token) return (event.context.sessionUser = null)
  const repo = await useUsers()
  const found = await repo.sessionUser(token)
  // A login lock only stops new sign-ins: someone guessing passwords must not be able to
  // sign the real user out. Deactivation ends the session.
  const user = found && found.user.status !== 'inactive' ? found.user : null
  if (token && found && user) {
    // Sliding idle timeout.
    const next = Date.now() + IDLE_MS
    if (next - found.expiresAt.getTime() > EXTEND_AFTER_MS) await repo.extendSession(token, new Date(next))
    setCookie(event, COOKIE, token, cookieOptions())
  }
  event.context.sessionUser = user
  return user
}

/** The signed-in user, or a 401/403 (rules in server/utils/access.ts). */
export async function requireUser(event: H3Event, role?: Role, opts: { allowPasswordChange?: boolean } = {}): Promise<User> {
  const user = await currentUser(event)
  const denial = accessDenial(user, role, opts)
  if (denial) throw createError(denial)
  return user!
}
