import { describe, expect, it } from 'vitest'
import type { User } from '#shared/types'
import { LOGIN_LOCK_MS, MAX_LOGIN_ATTEMPTS, lockAfterFailures, releaseExpiredLock } from '../server/utils/lockout'

const NOW = Date.parse('2026-10-27T08:00:00Z')
const user = (over: Partial<User>): User => ({
  id: 'u9',
  name: 'Tes',
  email: 'tes@rs-bethesda.test',
  role: 'staff',
  status: 'active',
  lastLogin: null,
  ...over,
})

describe('login lockout', () => {
  it('locks an active account at the failure limit, not before', () => {
    const u = user({})
    expect(lockAfterFailures(u, MAX_LOGIN_ATTEMPTS - 1, NOW)).toBe(false)
    expect(u.status).toBe('active')
    expect(lockAfterFailures(u, MAX_LOGIN_ATTEMPTS, NOW)).toBe(true)
    expect(u).toMatchObject({ status: 'locked', lockedUntil: new Date(NOW + LOGIN_LOCK_MS).toISOString() })
  })

  it('unlocks a locked account only after the lock time', () => {
    const u = user({ status: 'locked', lockedUntil: new Date(NOW + LOGIN_LOCK_MS).toISOString() })
    expect(releaseExpiredLock(u, NOW + LOGIN_LOCK_MS - 1)).toBe(false)
    expect(u.status).toBe('locked')
    expect(releaseExpiredLock(u, NOW + LOGIN_LOCK_MS + 1)).toBe(true)
    expect(u).toMatchObject({ status: 'active', lockedUntil: null })
  })

  // Regression: failed logins used to turn "inactive" into "locked", and the expired lock then made it "active".
  it('never locks or re-activates a deactivated account', () => {
    const u = user({ status: 'inactive' })
    expect(lockAfterFailures(u, MAX_LOGIN_ATTEMPTS + 10, NOW)).toBe(false)
    expect(u.status).toBe('inactive')
    expect(releaseExpiredLock(u, NOW + 10 * LOGIN_LOCK_MS)).toBe(false)
    expect(u.status).toBe('inactive')
  })

  it('keeps a deactivated account inactive even if it carries an old lock time', () => {
    const u = user({ status: 'inactive', lockedUntil: new Date(NOW - 1).toISOString() })
    expect(releaseExpiredLock(u, NOW)).toBe(false)
    expect(u.status).toBe('inactive')
  })

  it('does nothing for unknown emails', () => expect(lockAfterFailures(undefined, 99, NOW)).toBe(false))
})
