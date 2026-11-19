// Regression tests for the security audit of 17 Nov 2026 (M1 lockout, M2 emergency announcements).
import { describe, expect, it } from 'vitest'
import type { User } from '#shared/types'
import {
  ACCOUNT_LOCK_ATTEMPTS,
  LOGIN_LOCK_MS,
  MAX_LOGIN_ATTEMPTS,
  createLoginGuard,
} from '../server/utils/lockout'
import { emergencyDenial, isLiveEmergency } from '../server/utils/access'

const NOW = Date.parse('2026-11-17T08:00:00Z')
const ATTACKER = '198.51.100.66'
const OWNER = '203.0.113.10'
const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  name: 'Admin',
  email: 'admin@x.test',
  role: 'super',
  status: 'active',
  lastLogin: null,
  ...over,
})

describe('M1 · wrong passwords block the address, not the account', () => {
  it("someone else's wrong passwords do not stop the owner from signing in", () => {
    const g = createLoginGuard()
    const u = user()
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) g.fail(u.email, ATTACKER, u, NOW)
    expect(g.blocked(u.email, ATTACKER, u, NOW + 1)).not.toBeNull()
    expect(g.blocked(u.email, OWNER, u, NOW + 1)).toBeNull()
    expect(u.status).toBe('active')
  })

  it('the blocked address may try again after the lock time', () => {
    const g = createLoginGuard()
    const u = user()
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) g.fail(u.email, ATTACKER, u, NOW)
    expect(g.blocked(u.email, ATTACKER, u, NOW + LOGIN_LOCK_MS + 1)).toBeNull()
  })

  it('guessing spread over many addresses still locks the account itself', () => {
    const g = createLoginGuard()
    const u = user()
    let last
    for (let i = 0; i < ACCOUNT_LOCK_ATTEMPTS; i++) last = g.fail(u.email, `10.1.${i}.1`, u, NOW)
    expect(last).toMatchObject({ locked: true, realLock: true })
    expect(u.status).toBe('locked')
    expect(g.blocked(u.email, OWNER, u, NOW + 1)).not.toBeNull()
  })

  it('the account-wide count only covers the lock window', () => {
    const g = createLoginGuard()
    const u = user()
    for (let i = 0; i < ACCOUNT_LOCK_ATTEMPTS - 1; i++) g.fail(u.email, `10.2.${i}.1`, u, NOW)
    g.fail(u.email, '10.3.0.1', u, NOW + LOGIN_LOCK_MS + 1)
    expect(u.status).toBe('active')
  })

  it('a source lock on a real account is reported, a stand-in is not', () => {
    const g = createLoginGuard()
    let r
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) r = g.fail('admin@x.test', ATTACKER, user(), NOW)
    expect(r).toMatchObject({ locked: true, realLock: false, sourceLock: true })
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++)
      r = g.fail('nobody@x.test', ATTACKER, undefined, NOW)
    expect(r).toMatchObject({ locked: true, realLock: false, sourceLock: false })
  })

  it('a password reset (clear) lifts every block for the email', () => {
    const g = createLoginGuard()
    const u = user()
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) g.fail(u.email, OWNER, u, NOW)
    g.clear(u.email)
    expect(g.blocked(u.email, OWNER, u, NOW + 1)).toBeNull()
  })

  it('unknown emails still answer exactly like real ones, from one address and from many', () => {
    const run = (u: User | undefined, ips: (i: number) => string, n: number) => {
      const g = createLoginGuard()
      const out: string[] = []
      for (let i = 0; i < n; i++) {
        if (g.blocked('a@x.test', ips(i), u, NOW)) out.push('423')
        else {
          const r = g.fail('a@x.test', ips(i), u, NOW)
          out.push(r.locked ? '423' : `401:${r.remaining}`)
        }
      }
      return out
    }
    const one = () => ATTACKER
    const many = (i: number) => `10.9.${i}.1`
    expect(run(undefined, one, 8)).toEqual(run(user(), one, 8))
    expect(run(undefined, many, ACCOUNT_LOCK_ATTEMPTS + 2)).toEqual(
      run(user(), many, ACCOUNT_LOCK_ATTEMPTS + 2),
    )
  })
})

describe('M2 · emergency announcements go live only through a Super Admin', () => {
  const staff = { role: 'staff' as const }
  const sup = { role: 'super' as const }
  const ann = (over: Record<string, unknown> = {}) => ({
    kind: 'pengumuman',
    status: 'published',
    level: 'darurat',
    archived: false,
    ...over,
  })

  it('knows what counts as a live emergency', () => {
    expect(isLiveEmergency(ann())).toBe(true)
    expect(isLiveEmergency(ann({ status: 'draft' }))).toBe(false)
    expect(isLiveEmergency(ann({ level: 'penting' }))).toBe(false)
    expect(isLiveEmergency(ann({ archived: true }))).toBe(false)
    expect(isLiveEmergency({ kind: 'gambar', status: 'published' })).toBe(false)
  })

  it('staff may draft an emergency announcement but not publish it', () => {
    expect(emergencyDenial(staff, null, ann({ status: 'draft' }))).toBeNull()
    expect(emergencyDenial(staff, null, ann())?.statusCode).toBe(403)
    expect(emergencyDenial(staff, ann({ status: 'draft' }), ann())?.statusCode).toBe(403)
  })

  it('staff may not change, take down or extend a published emergency announcement', () => {
    expect(emergencyDenial(staff, ann(), ann({ level: 'info' }))?.statusCode).toBe(403)
    expect(emergencyDenial(staff, ann(), null)?.statusCode).toBe(403)
    expect(emergencyDenial(staff, ann(), ann())?.statusCode).toBe(403)
  })

  it('staff keep publishing promos and ordinary announcements', () => {
    expect(emergencyDenial(staff, null, { kind: 'gambar', status: 'published' })).toBeNull()
    expect(emergencyDenial(staff, null, ann({ level: 'penting' }))).toBeNull()
  })

  it('Super Admins may do all of it', () => {
    expect(emergencyDenial(sup, null, ann())).toBeNull()
    expect(emergencyDenial(sup, ann(), null)).toBeNull()
  })
})
