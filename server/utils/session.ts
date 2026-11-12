import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { Role, User } from '#shared/types'

// Server-side sessions: the cookie holds only an unguessable random token.
// The real backend replaces this with its own session store.
const COOKIE = 'nfc_session'
const IDLE_MS = 30 * 60 * 1000

interface Session {
  userId: string
  expiresAt: number
}
const sessions = new Map<string, Session>()

function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: !import.meta.dev, path: '/', maxAge: IDLE_MS / 1000 }
}

export function createSession(event: H3Event, userId: string) {
  // Rotate: drop any session the browser already had.
  destroySession(event)
  // Expired sessions are otherwise only removed when they are used again.
  const now = Date.now()
  for (const [t, s] of sessions) if (s.expiresAt < now) sessions.delete(t)
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { userId, expiresAt: Date.now() + IDLE_MS })
  setCookie(event, COOKIE, token, cookieOptions())
}

export function destroySession(event: H3Event) {
  const token = getCookie(event, COOKIE)
  if (token) sessions.delete(token)
  deleteCookie(event, COOKIE, { path: '/' })
}

/** Ends every session of a user, e.g. after deactivation or a password reset. */
export function destroyUserSessions(userId: string) {
  for (const [token, s] of sessions) if (s.userId === userId) sessions.delete(token)
}

export function currentUser(event: H3Event): User | null {
  const token = getCookie(event, COOKIE)
  const session = token ? sessions.get(token) : undefined
  if (!token || !session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  const user = db.users.find(u => u.id === session.userId)
  // A login lock only stops new sign-ins: someone guessing passwords must not be able to
  // sign the real user out. Deactivation ends the session.
  if (!user || user.status === 'inactive') return null
  // Sliding idle timeout.
  session.expiresAt = Date.now() + IDLE_MS
  setCookie(event, COOKIE, token, cookieOptions())
  return user
}

/** The signed-in user, or a 401/403 (rules in server/utils/access.ts). */
export function requireUser(event: H3Event, role?: Role, opts: { allowPasswordChange?: boolean } = {}): User {
  const user = currentUser(event)
  const denial = accessDenial(user, role, opts)
  if (denial) throw createError(denial)
  return user!
}
