import type { User } from '#shared/types'

// Login lockout rules. The time lock is a temporary state of an *active* account:
// it never touches deactivated accounts, so a failed-login timer can't bring one back.
export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_LOCK_MS = 15 * 60 * 1000
/** Above this many tracked emails, old entries are dropped so the maps can't grow without end. */
const PRUNE_AT = 10_000

/** Lifts an expired time lock. Returns true when the account was unlocked. */
export function releaseExpiredLock(user: User, now: number): boolean {
  if (user.status !== 'locked' || !user.lockedUntil || new Date(user.lockedUntil).getTime() >= now) return false
  user.status = 'active'
  user.lockedUntil = null
  return true
}

/** Locks an active account once it reaches the failure limit. Returns true when it was locked now. */
export function lockAfterFailures(user: User | undefined, failures: number, now: number): boolean {
  if (!user || user.status !== 'active' || failures < MAX_LOGIN_ATTEMPTS) return false
  user.status = 'locked'
  user.lockedUntil = new Date(now + LOGIN_LOCK_MS).toISOString()
  return true
}

export type FailResult = { locked: true; until: string; realLock: boolean } | { locked: false; remaining: number }

/**
 * Failure counting for the login route. Emails without an active account (unknown or deactivated)
 * get a stand-in lock after the same number of failures, so the answers never tell which emails exist.
 */
export function createLoginGuard() {
  const failures = new Map<string, number>()
  const standIns = new Map<string, number>()

  function prune(now: number) {
    if (standIns.size > PRUNE_AT) for (const [email, until] of standIns) if (until <= now) standIns.delete(email)
    // Maps keep insertion order: drop the oldest counters first.
    for (const email of failures.keys()) {
      if (failures.size <= PRUNE_AT) break
      failures.delete(email)
    }
  }

  return {
    /** The lock that stops this attempt, or null. Also lifts an expired account lock. */
    blocked(email: string, user: User | undefined, now: number): { until: string | null } | null {
      if (user && releaseExpiredLock(user, now)) failures.delete(email)
      if (user?.status === 'locked') return { until: user.lockedUntil ?? null }
      if (user?.status === 'active') return null
      const until = standIns.get(email)
      if (until === undefined) return null
      if (until > now) return { until: new Date(until).toISOString() }
      standIns.delete(email)
      failures.delete(email)
      return null
    },

    /** Counts a failed attempt; locks at the limit (the real account, or a stand-in). */
    fail(email: string, user: User | undefined, now: number): FailResult {
      prune(now)
      const n = (failures.get(email) ?? 0) + 1
      failures.set(email, n)
      if (lockAfterFailures(user, n, now)) return { locked: true, until: user!.lockedUntil!, realLock: true }
      if (user?.status !== 'active' && n >= MAX_LOGIN_ATTEMPTS) {
        standIns.set(email, now + LOGIN_LOCK_MS)
        return { locked: true, until: new Date(now + LOGIN_LOCK_MS).toISOString(), realLock: false }
      }
      return { locked: false, remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - n) }
    },

    succeed(email: string) {
      failures.delete(email)
    },
  }
}
