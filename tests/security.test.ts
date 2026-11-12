import { describe, expect, it } from 'vitest'
import type { Poster, User } from '#shared/types'
import { PUBLIC_POSTER_FIELDS } from '#shared/types'
import { pickClientIp } from '../server/utils/clientIp'
import { LOGIN_LOCK_MS, MAX_LOGIN_ATTEMPTS, createLoginGuard } from '../server/utils/lockout'
import { BODY_LIMIT, UPLOAD_BODY_LIMIT, bodySizeError, originHost } from '../server/utils/requestChecks'
import { imagePosterSchema } from '../server/utils/validation'
import { adminReturnPath } from '../app/utils/returnPath'

const NOW = Date.parse('2026-10-27T08:00:00Z')
const user = (status: User['status']): User => ({ id: 'u9', name: 'Tes', email: 'tes@x.test', role: 'staff', status, lastLogin: null })

describe('client IP for rate limiting (SEC-04)', () => {
  it('ignores X-Forwarded-For unless a proxy is trusted', () => {
    expect(pickClientIp('203.0.113.9', '10.0.0.1', false)).toBe('203.0.113.9')
  })
  it('behind a trusted proxy, uses the entry the proxy appended (right-most), not the forgeable left one', () => {
    expect(pickClientIp('127.0.0.1', '10.6.6.6, 198.51.100.7', true)).toBe('198.51.100.7')
    expect(pickClientIp('127.0.0.1', undefined, true)).toBe('127.0.0.1')
  })
})

describe('login guard (SEC-05)', () => {
  // Runs MAX+1 failures and returns what each one answered.
  const answers = (u: User | undefined) => {
    const g = createLoginGuard()
    const out: string[] = []
    for (let i = 0; i <= MAX_LOGIN_ATTEMPTS; i++) {
      const lock = g.blocked('a@x.test', u, NOW)
      if (lock) out.push('423')
      else {
        const r = g.fail('a@x.test', u, NOW)
        out.push(r.locked ? '423' : `401:${r.remaining}`)
      }
    }
    return out
  }

  it('answers an unknown email exactly like a real one', () => {
    expect(answers(undefined)).toEqual(answers(user('active')))
    expect(answers(user('inactive'))).toEqual(answers(user('active')))
    expect(answers(undefined)).toEqual(['401:4', '401:3', '401:2', '401:1', '423', '423'])
  })

  it('stand-in locks never change a deactivated account, and expire like real ones', () => {
    const g = createLoginGuard()
    const u = user('inactive')
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) g.fail('a@x.test', u, NOW)
    expect(u.status).toBe('inactive')
    expect(g.blocked('a@x.test', u, NOW + 1)).not.toBeNull()
    expect(g.blocked('a@x.test', u, NOW + LOGIN_LOCK_MS + 1)).toBeNull()
    expect(u.status).toBe('inactive')
  })

  it('a stand-in lock does not block an account that became active', () => {
    const g = createLoginGuard()
    const u = user('inactive')
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) g.fail('a@x.test', u, NOW)
    u.status = 'active'
    expect(g.blocked('a@x.test', u, NOW + 1)).toBeNull()
  })
})

describe('request checks (SEC-07, SEC-09)', () => {
  it('treats a non-URL Origin such as "null" as foreign instead of crashing', () => {
    expect(originHost('null')).toBeNull()
    expect(originHost('https://poster.rs-bethesda.test')).toBe('poster.rs-bethesda.test')
  })
  it('refuses bodies over the limit before reading them', () => {
    expect(bodySizeError('/api/uploads', String(UPLOAD_BODY_LIMIT), undefined)).toBeNull()
    expect(bodySizeError('/api/uploads', String(40 * 1024 * 1024), undefined)).toBe(413)
    expect(bodySizeError('/api/posters', String(BODY_LIMIT + 1), undefined)).toBe(413)
    expect(bodySizeError('/api/posters?x=1', 'abc', undefined)).toBe(413)
    expect(bodySizeError('/api/posters', undefined, 'chunked')).toBe(411)
    expect(bodySizeError('/api/auth/logout', undefined, undefined)).toBeNull()
  })
})

describe('uploads (SEC-06)', () => {
  it('only accepts the random 128-bit upload IDs', () => {
    const base = {
      kind: 'gambar',
      status: 'draft',
      name: 'P',
      title: 'P',
      description: 'P',
      buttons: [],
      start: '2026-10-01',
      end: '2026-10-02',
    }
    expect(imagePosterSchema.safeParse({ ...base, imageUrl: '/api/uploads/f0123456789abcdef0123456789abcdef' }).success).toBe(true)
    for (const imageUrl of ['/api/uploads/f101', '/api/uploads/f0123456789ABCDEF0123456789ABCDEF'])
      expect(imagePosterSchema.safeParse({ ...base, imageUrl }).error?.issues[0]?.path).toEqual(['imageUrl'])
  })
})

describe('public poster fields (SEC-08)', () => {
  it('leave out internal fields', () => {
    const internal: (keyof Poster)[] = [
      'name',
      'updatedBy',
      'updatedAt',
      'imageFile',
      'imageSize',
      'status',
      'archived',
      'design',
      'brochureFile',
    ]
    for (const k of internal) expect(PUBLIC_POSTER_FIELDS).not.toContain(k)
  })
})

describe('login return path (FE-01)', () => {
  it('keeps admin pages', () => {
    expect(adminReturnPath('/admin/analytics')).toBe('/admin/analytics')
    expect(adminReturnPath('/admin?x=1')).toBe('/admin?x=1')
  })
  it('sends everything else to the dashboard', () => {
    for (const returnTo of [
      undefined,
      ['/admin'],
      '//example.com',
      '/\\example.com',
      'https://example.com',
      '/administrator',
      '/admin\\..',
      '/k/ABC',
    ])
      expect(adminReturnPath(returnTo)).toBe('/admin')
  })
})
