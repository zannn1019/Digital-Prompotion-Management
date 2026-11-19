import type { User } from '#shared/types'

// Login lockout rules.
//
// Wrong passwords are counted per email *and* client address. Five in a row from one address block that
// address for that email for 15 minutes; the real user, signing in from their own device, is not affected.
// So nobody can lock someone else out just by knowing their email.
// Guessing spread over many addresses is caught by a much higher count per email: at that point the
// account itself is locked (status `locked`, recorded in the Audit Log) until the time runs out or a
// Super Admin resets the password.
// The account lock is a temporary state of an *active* account: it never touches deactivated accounts,
// so a failed-login timer can't bring one back.

/** Wrong passwords in a row from one address before that address is blocked for the email. */
export const MAX_LOGIN_ATTEMPTS = 5
/** Wrong passwords for one email, from all addresses within LOGIN_LOCK_MS, before the account is locked. */
export const ACCOUNT_LOCK_ATTEMPTS = 50
export const LOGIN_LOCK_MS = 15 * 60 * 1000
/** Above this many tracked entries, old ones are dropped so the maps can't grow without end. */
const PRUNE_AT = 10_000

/** Lifts an expired time lock. Returns true when the account was unlocked. */
export function releaseExpiredLock(user: User, now: number): boolean {
  if (user.status !== 'locked' || !user.lockedUntil || new Date(user.lockedUntil).getTime() >= now)
    return false
  user.status = 'active'
  user.lockedUntil = null
  return true
}

/** Locks an active account once it reaches the account-wide failure limit. Returns true when it was locked now. */
export function lockAfterFailures(user: User | undefined, failures: number, now: number): boolean {
  if (!user || user.status !== 'active' || failures < ACCOUNT_LOCK_ATTEMPTS) return false
  user.status = 'locked'
  user.lockedUntil = new Date(now + LOGIN_LOCK_MS).toISOString()
  return true
}

/**
 * `realLock`: the account itself was locked now (worth an Audit Log entry).
 * `sourceLock`: this address was blocked for an existing account (also worth recording).
 */
export type FailResult =
  | { locked: true; until: string; realLock: boolean; sourceLock: boolean }
  | { locked: false; remaining: number }

/**
 * Failure counting for the login route. Emails without an active account (unknown or deactivated)
 * get the same per-address and account-wide stand-in locks, so the answers never tell which emails exist.
 */
export function createLoginGuard() {
  /** `email|address` → wrong passwords in a row. */
  const sourceFails = new Map<string, number>()
  /** `email|address` → blocked until (ms). */
  const sourceLocks = new Map<string, number>()
  /** email → wrong passwords from all addresses in the current window. */
  const accountFails = new Map<string, { n: number; since: number }>()
  /** email → account-wide stand-in lock for emails without an active account. */
  const standIns = new Map<string, number>()

  const key = (email: string, ip: string) => `${email}|${ip}`

  function prune(now: number) {
    for (const m of [sourceLocks, standIns])
      if (m.size > PRUNE_AT) for (const [k, until] of m) if (until <= now) m.delete(k)
    if (accountFails.size > PRUNE_AT)
      for (const [k, w] of accountFails) if (now - w.since > LOGIN_LOCK_MS) accountFails.delete(k)
    // Maps keep insertion order: drop the oldest counters first.
    for (const k of sourceFails.keys()) {
      if (sourceFails.size <= PRUNE_AT) break
      sourceFails.delete(k)
    }
  }

  return {
    /** The lock that stops this attempt, or null. Also lifts an expired account lock. */
    blocked(
      email: string,
      ip: string,
      user: User | undefined,
      now: number,
    ): { until: string | null } | null {
      if (user && releaseExpiredLock(user, now)) accountFails.delete(email)
      if (user?.status === 'locked') return { until: user.lockedUntil ?? null }
      if (user?.status !== 'active') {
        const until = standIns.get(email)
        if (until !== undefined && until > now) return { until: new Date(until).toISOString() }
        if (until !== undefined) {
          standIns.delete(email)
          accountFails.delete(email)
        }
      }
      const k = key(email, ip)
      const until = sourceLocks.get(k)
      if (until === undefined) return null
      if (until > now) return { until: new Date(until).toISOString() }
      sourceLocks.delete(k)
      sourceFails.delete(k)
      return null
    },

    /** Counts a failed attempt; blocks the address at its limit, and the account (or a stand-in) at the account limit. */
    fail(email: string, ip: string, user: User | undefined, now: number): FailResult {
      prune(now)
      const k = key(email, ip)
      const n = (sourceFails.get(k) ?? 0) + 1
      sourceFails.set(k, n)

      const w = accountFails.get(email)
      const win =
        w && now - w.since <= LOGIN_LOCK_MS ? { n: w.n + 1, since: w.since } : { n: 1, since: now }
      accountFails.set(email, win)

      if (lockAfterFailures(user, win.n, now))
        return { locked: true, until: user!.lockedUntil!, realLock: true, sourceLock: false }
      if (user?.status !== 'active' && win.n >= ACCOUNT_LOCK_ATTEMPTS)
        standIns.set(email, now + LOGIN_LOCK_MS)

      if (n >= MAX_LOGIN_ATTEMPTS) {
        const until = now + LOGIN_LOCK_MS
        sourceLocks.set(k, until)
        return {
          locked: true,
          until: new Date(until).toISOString(),
          realLock: false,
          sourceLock: user?.status === 'active',
        }
      }
      if (standIns.has(email))
        return {
          locked: true,
          until: new Date(standIns.get(email)!).toISOString(),
          realLock: false,
          sourceLock: false,
        }
      return { locked: false, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - n) }
    },

    /** The right password from this address: its counter starts again, and so does the account-wide one. */
    succeed(email: string, ip: string) {
      sourceFails.delete(key(email, ip))
      sourceLocks.delete(key(email, ip))
      accountFails.delete(email)
    },

    /** Forgets every counter and block for an email, e.g. after a Super Admin reset its password. */
    clear(email: string) {
      const prefix = `${email}|`
      for (const m of [sourceFails, sourceLocks])
        for (const k of m.keys()) if (k.startsWith(prefix)) m.delete(k)
      accountFails.delete(email)
      standIns.delete(email)
    },
  }
}

/** The one guard of this server process, shared by the login route and the password reset. */
export const loginGuard = createLoginGuard()
