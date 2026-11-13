import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { User } from '#shared/types'
import { DEDUPE_MS, createVisitCounter, isBot, isPrefetch } from '../server/utils/tapCounter'
import { cspHeader, inlineScriptHashes } from '../server/utils/csp'
import { DEMO_PASSWORD, hashPassword, hashPasswordSync, seedPassword, tempPassword, verifyPassword } from '../server/utils/passwords'
import { MUST_CHANGE_PASSWORD, accessDenial } from '../server/utils/access'
import { publicUser } from '../server/utils/users'
import { passwordChangeSchema } from '../server/utils/validation'
import { posterLink } from '../app/utils/posterLink'
import { pickClientIp } from '../server/utils/clientIp'
import { cardBaseUrl } from '../server/utils/cardLink'

const NOW = Date.parse('2026-10-27T08:00:00Z')
const PHONE = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' }
const user = (extra: Partial<User> = {}): User => ({
  id: 'u9',
  name: 'Tes',
  email: 'tes@x.test',
  role: 'staff',
  status: 'active',
  lastLogin: null,
  ...extra,
})

describe('visitor address for server-rendered taps (SEC-11)', () => {
  it('uses the visitor address the page passes on, but only on the server-internal call (no socket)', () => {
    // Internal request while rendering /k/:code: no socket address.
    expect(pickClientIp('', undefined, false, '203.0.113.9')).toBe('203.0.113.9')
    expect(pickClientIp(undefined, undefined, false, '198.51.100.7')).toBe('198.51.100.7')
  })
  it('ignores that header on requests from outside, so it cannot be used to fake new visitors', () => {
    expect(pickClientIp('203.0.113.9', undefined, false, '10.9.9.9')).toBe('203.0.113.9')
    expect(pickClientIp('127.0.0.1', '198.51.100.7', true, '10.9.9.9')).toBe('198.51.100.7')
  })
})

describe('tap and click counting (SEC-11)', () => {
  it('counts the same visitor, card and target once within 30 s', () => {
    const c = createVisitCounter()
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW)).toBe('count')
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW + 1_000)).toBe('repeat')
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW + DEDUPE_MS - 1)).toBe('repeat')
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW + DEDUPE_MS)).toBe('count')
  })
  it('counts other visitors, cards and buttons separately', () => {
    const c = createVisitCounter()
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW)).toBe('count')
    expect(c.classify('198.51.100.7', 'tap|K7Q2M9XA', PHONE, NOW)).toBe('count')
    expect(c.classify('203.0.113.9', 'tap|9VJ6CEUA', PHONE, NOW)).toBe('count')
    expect(c.classify('203.0.113.9', 'click|K7Q2M9XA|p1|wa', PHONE, NOW)).toBe('count')
    expect(c.classify('203.0.113.9', 'click|K7Q2M9XA|p1|tel', PHONE, NOW)).toBe('count')
  })
  it('ignores browser prefetches (Sec-Purpose and the older Purpose header)', () => {
    expect(isPrefetch('prefetch', undefined)).toBe(true)
    expect(isPrefetch('prefetch;prerender', undefined)).toBe(true)
    expect(isPrefetch(undefined, 'prefetch')).toBe(true)
    expect(isPrefetch(undefined, undefined)).toBe(false)
    const c = createVisitCounter()
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', { ...PHONE, secPurpose: 'prefetch' }, NOW)).toBe('prefetch')
    // A prefetch does not use up the visitor's real tap.
    expect(c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW + 10)).toBe('count')
  })
  it('sends link-preview bots and crawlers to the bots column', () => {
    for (const ua of [
      'WhatsApp/2.23.20.0',
      'facebookexternalhit/1.1',
      'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0',
      'Googlebot/2.1',
      'Some Crawler',
      'Link Preview',
    ])
      expect(isBot(ua), ua).toBe(true)
    expect(isBot(PHONE.userAgent)).toBe(false)
    expect(createVisitCounter().classify('203.0.113.9', 'tap|K7Q2M9XA', { userAgent: 'WhatsApp/2.23' }, NOW)).toBe('bot')
  })
  it('keeps the dedupe map bounded', () => {
    const c = createVisitCounter()
    for (let i = 0; i < 10_001; i++) c.classify(`10.0.${i >> 8}.${i & 255}`, 'tap|K7Q2M9XA', PHONE, NOW)
    expect(c.size()).toBe(10_001)
    // Once the old entries expire, the next request prunes them.
    c.classify('203.0.113.9', 'tap|K7Q2M9XA', PHONE, NOW + DEDUPE_MS + 1)
    expect(c.size()).toBe(1)
  })
})

describe('Content-Security-Policy (SEC-12)', () => {
  const config = 'window.__NUXT__={};window.__NUXT__.config={public:{}}'
  const html = `<head><script type="module" src="/_nuxt/entry.js"></script></head><body><div id="__nuxt"></div>
<script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">[{"state":1}]</script>
<script>${config}</script></body>`

  it('drops unsafe-inline from script-src', () => {
    const scriptSrc = cspHeader()
      .split('; ')
      .find(d => d.startsWith('script-src'))
    expect(scriptSrc).toBe("script-src 'self'")
    expect(cspHeader()).not.toMatch(/script-src[^;]*unsafe-inline/)
  })
  it('allows exactly the inline scripts the page contains, by sha256', () => {
    const expected = `'sha256-${createHash('sha256').update(config).digest('base64')}'`
    expect(inlineScriptHashes(html)).toEqual([expected])
    expect(cspHeader(inlineScriptHashes(html))).toContain(`script-src 'self' ${expected};`)
  })
  it('does not hash external scripts or JSON data blocks', () => {
    expect(inlineScriptHashes('<script src="/a.js"></script><script type="application/json">{}</script>')).toEqual([])
  })
})

describe('poster link for the QR code (SEC-14)', () => {
  const forged = () => 'https://evil.test'
  it('uses the configured site address and ignores the request', () => {
    expect(posterLink('K7Q2M9XA', 'https://poster.rs-bethesda.test/', false, forged)).toBe('https://poster.rs-bethesda.test/k/K7Q2M9XA')
  })
  it('in production without a site address, shows no QR code instead of trusting the request', () => {
    expect(posterLink('K7Q2M9XA', '', false, forged)).toBeUndefined()
  })
  it('in dev without a site address, uses the request origin', () => {
    expect(posterLink('K7Q2M9XA', '', true, () => 'http://localhost:3000')).toBe('http://localhost:3000/k/K7Q2M9XA')
  })
})

describe('password storage (SEC-01)', () => {
  it('stores a salted scrypt hash, never the password itself', async () => {
    const a = await hashPassword('kata-sandi-baru')
    const b = await hashPassword('kata-sandi-baru')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(JSON.stringify(a)).not.toContain('kata-sandi-baru')
    expect(Buffer.from(a.salt, 'base64')).toHaveLength(16)
  })
  it('accepts only the right password', async () => {
    const stored = await hashPassword('kata-sandi-baru')
    expect(await verifyPassword('kata-sandi-baru', stored)).toBe(true)
    expect(await verifyPassword('kata-sandi-lama', stored)).toBe(false)
    expect(await verifyPassword('kata-sandi-baru', undefined)).toBe(false)
    // Start-up seeding uses the synchronous variant; both produce compatible hashes.
    expect(await verifyPassword('kata-sandi-baru', hashPasswordSync('kata-sandi-baru'))).toBe(true)
  })
  // Regression: scryptSync stopped the whole server for ~40 ms on every login attempt.
  it('checks a password without blocking the server', async () => {
    const stored = hashPasswordSync('kata-sandi-baru')
    let ticks = 0
    const timer = setInterval(() => ticks++, 0)
    await Promise.all(Array.from({ length: 4 }, () => verifyPassword('kata-sandi-baru', stored)))
    clearInterval(timer)
    expect(ticks).toBeGreaterThan(0)
  })
  it('no longer lets any password containing "demo" in', async () => {
    // The old rule was /demo/i.test(password) for every active account.
    const stored = hashPasswordSync(DEMO_PASSWORD)
    expect(await verifyPassword(DEMO_PASSWORD, stored)).toBe(true)
    for (const pw of ['demo', 'xdemox', 'DEMO123', 'demo1234', 'demo-abc']) expect(await verifyPassword(pw, stored), pw).toBe(false)
  })
  it('temporary passwords are random and only their own hash accepts them', async () => {
    const pw = tempPassword()
    expect(pw).toMatch(/^[\w-]{12}$/)
    expect(pw).not.toMatch(/demo/i)
    expect(tempPassword()).not.toBe(pw)
    const stored = await hashPassword(pw)
    expect(await verifyPassword(pw, stored)).toBe(true)
    expect(await verifyPassword('demo123', stored)).toBe(false)
  })
})

describe('user data sent to the browser (SEC-01)', () => {
  it('has a fixed set of fields and no credentials', () => {
    const out = publicUser({ ...user(), ...({ hash: 'x', salt: 'y', password: 'z' } as object) } as User)
    expect(Object.keys(out).sort()).toEqual(['email', 'id', 'lastLogin', 'lockedUntil', 'mustChangePassword', 'name', 'role', 'status'])
  })
})

describe('forced password change (SEC-01)', () => {
  it('blocks every route with 403 while the temporary password is still in use', () => {
    expect(accessDenial(user({ mustChangePassword: true }))).toEqual({
      statusCode: 403,
      statusMessage: MUST_CHANGE_PASSWORD,
      data: { mustChangePassword: true },
    })
    expect(accessDenial(user({ mustChangePassword: true, role: 'super' }), 'super')?.statusCode).toBe(403)
  })
  it('lets the change route through, and everything after the change', () => {
    expect(accessDenial(user({ mustChangePassword: true }), undefined, { allowPasswordChange: true })).toBeNull()
    expect(accessDenial(user({ mustChangePassword: false }))).toBeNull()
  })
  it('keeps the existing 401 and Super Admin checks', () => {
    expect(accessDenial(null)?.statusCode).toBe(401)
    expect(accessDenial(user(), 'super')).toEqual({ statusCode: 403, statusMessage: 'Halaman ini khusus Super Admin.' })
  })
})

describe('password change input (SEC-01)', () => {
  const err = (body: unknown) => {
    const r = passwordChangeSchema.safeParse(body)
    return r.success ? null : Object.fromEntries(r.error.issues.map(i => [i.path.join('.'), i.message]))
  }
  it('needs a new password of at least 10 characters', () => {
    expect(err({ currentPassword: 'abc', newPassword: 'pendek123' })).toEqual({ newPassword: 'Minimal 10 karakter.' })
    expect(err({ currentPassword: 'abc', newPassword: 'cukup-panjang' })).toBeNull()
  })
  it('refuses the same password and unknown fields', () => {
    expect(err({ currentPassword: 'sama-persis-123', newPassword: 'sama-persis-123' })).toEqual({
      newPassword: 'Kata sandi baru harus berbeda dari yang lama.',
    })
    expect(passwordChangeSchema.safeParse({ currentPassword: 'a', newPassword: 'cukup-panjang', role: 'super' }).success).toBe(false)
  })
  it('needs the current password', () => {
    expect(err({ currentPassword: '', newPassword: 'cukup-panjang' })).toEqual({ currentPassword: 'Isian ini wajib diisi.' })
  })
})

describe('staging deploy settings', () => {
  it('seeded accounts use NUXT_SEED_PASSWORD when set, the demo password otherwise', () => {
    expect(seedPassword(undefined)).toBe(DEMO_PASSWORD)
    expect(seedPassword('')).toBe(DEMO_PASSWORD)
    expect(seedPassword('Rahasia-Staging-2026')).toBe('Rahasia-Staging-2026')
  })
  it('refuses a seed password shorter than the minimum, so the server does not start with a weak one', () => {
    expect(() => seedPassword('pendek')).toThrow('NUXT_SEED_PASSWORD must be at least 10 characters.')
  })
  // Regression: card URLs were always https://poster.rs-bethesda.test/k/<code>, so written cards led nowhere.
  it('writes cards with the configured site address', () => {
    const forged = () => 'https://evil.test'
    expect(cardBaseUrl('https://staging.example.co.id/', false, forged, 'https://placeholder.test/k/')).toBe(
      'https://staging.example.co.id/k/',
    )
    expect(cardBaseUrl('', true, () => 'http://localhost:3000', 'https://placeholder.test/k/')).toBe('http://localhost:3000/k/')
    expect(cardBaseUrl('', false, forged, 'https://placeholder.test/k/')).toBe('https://placeholder.test/k/')
  })
})
