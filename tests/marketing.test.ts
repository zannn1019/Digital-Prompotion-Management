// Marketing role: who owns posters, pages and cards, the marketing user's contact on their posters, and the
// per-marketing analytics. Pure logic only; the database round trip is in tests/db.
import { describe, expect, it } from 'vitest'
import {
  OWNER_NOT_MARKETING,
  contactNumbers,
  contactOwner,
  pickOwner,
} from '../server/utils/access'
import { byMarketing } from '../server/utils/marketingStats'
import {
  cardBulkSchema,
  cardRegisterSchema,
  imagePosterSchema,
  pageUpdateSchema,
  userCreateSchema,
  userPatchSchema,
} from '../server/utils/validation'
import { PUBLIC_POSTER_FIELDS } from '#shared/types'
import { ROLE_LABEL } from '#shared/constants'

const poster = {
  kind: 'gambar',
  status: 'draft',
  name: 'Promo',
  imageUrl: '/api/uploads/f0123456789abcdef0123456789abcdef',
  title: 'Sleep Lab',
  description: 'Promo',
  buttons: ['wa', 'tel'],
  start: '2026-11-01',
  end: '2026-11-30',
}

describe('marketing role', () => {
  it('is a role users can be given', () => {
    expect(ROLE_LABEL.marketing).toBe('Marketing')
    expect(
      userCreateSchema.safeParse({ name: 'Rina', email: 'rina@rs.test', role: 'marketing' })
        .success,
    ).toBe(true)
    expect(userPatchSchema.safeParse({ role: 'marketing' }).success).toBe(true)
    expect(userPatchSchema.safeParse({ role: 'owner' }).success).toBe(false)
  })
})

describe('owner rule (pickOwner)', () => {
  const marketer = { id: 'u-m', role: 'marketing' as const }
  const staff = { id: 'u-s', role: 'staff' as const }
  const active = { role: 'marketing' as const, status: 'active' as const }

  it('gives a new item to its creator when the creator is Marketing', () => {
    expect(pickOwner(undefined, marketer, undefined, null)).toEqual({ ownerId: 'u-m' })
    expect(pickOwner(undefined, staff, undefined, null)).toEqual({ ownerId: null })
  })

  it('keeps the current owner when the form sends none', () => {
    expect(pickOwner(undefined, staff, 'u-x', null)).toEqual({ ownerId: 'u-x' })
    expect(pickOwner(undefined, marketer, null, null)).toEqual({ ownerId: null })
  })

  it('clears the owner with null', () =>
    expect(pickOwner(null, staff, 'u-x', null)).toEqual({ ownerId: null }))

  it('accepts an active Marketing user', () =>
    expect(pickOwner('u-y', staff, null, active)).toEqual({ ownerId: 'u-y' }))

  it('refuses unknown users, other roles and deactivated marketers', () => {
    for (const found of [
      null,
      { role: 'staff' as const, status: 'active' as const },
      { role: 'super' as const, status: 'active' as const },
      { role: 'marketing' as const, status: 'inactive' as const },
    ])
      expect(pickOwner('u-y', staff, null, found)).toEqual({ error: OWNER_NOT_MARKETING })
  })

  it('lets an item keep an owner who has since been deactivated', () =>
    expect(pickOwner('u-old', staff, 'u-old', { role: 'marketing', status: 'inactive' })).toEqual({
      ownerId: 'u-old',
    }))
})

describe('owner fields in the API input', () => {
  it('posters, pages and cards accept an owner or null', () => {
    expect(imagePosterSchema.safeParse({ ...poster, ownerId: 'u1' }).success).toBe(true)
    expect(imagePosterSchema.safeParse({ ...poster, ownerId: null }).success).toBe(true)
    expect(pageUpdateSchema.safeParse({ ownerId: 'u1' }).success).toBe(true)
    expect(
      cardRegisterSchema.safeParse({
        count: 1,
        label: 'Lobi',
        group: 'RS',
        pageId: null,
        ownerId: 'u1',
      }).success,
    ).toBe(true)
  })

  it('cards can be handed to a marketing user in bulk', () => {
    expect(
      cardBulkSchema.safeParse({ action: 'owner', codes: ['ABCD2345'], ownerId: 'u1' }).success,
    ).toBe(true)
    expect(
      cardBulkSchema.safeParse({ action: 'owner', codes: ['ABCD2345'], ownerId: null }).success,
    ).toBe(true)
  })
})

describe('marketing contact (on the marketing user)', () => {
  const settings = { wa: '628000000001', phone: '0274 000000', email: 'info@rs.test' }
  const rina = {
    role: 'marketing' as const,
    status: 'active' as const,
    email: 'rina@rs.test',
    wa: '6281234567890',
    phone: '0274 586688',
  }

  it('users accept a WhatsApp and phone in the Settings formats, or empty ones', () => {
    const base = { name: 'Rina', email: 'rina@rs.test', role: 'marketing' }
    expect(userCreateSchema.safeParse({ ...base, wa: rina.wa, phone: rina.phone }).success).toBe(
      true,
    )
    expect(userCreateSchema.safeParse({ ...base, wa: '', phone: '' }).success).toBe(true)
    expect(userPatchSchema.safeParse({ wa: rina.wa }).success).toBe(true)
  })

  it('refuses malformed numbers', () => {
    for (const wa of ['+6281234567890', '081234567890', '62 812 3456', 'wa.me/62812'])
      expect(userPatchSchema.safeParse({ wa }).success).toBe(false)
    expect(userPatchSchema.safeParse({ phone: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('posters no longer take a typed-in contact', () =>
    expect(imagePosterSchema.safeParse({ ...poster, contactWa: rina.wa }).success).toBe(false))

  it("the buttons use the owner's WhatsApp, phone and email", () =>
    expect(contactNumbers(rina, settings)).toEqual({
      wa: rina.wa,
      phone: rina.phone,
      email: rina.email,
    }))

  it('each missing number falls back to Settings', () =>
    expect(contactNumbers({ ...rina, wa: null, phone: '' }, settings)).toEqual({
      ...settings,
      email: rina.email,
    }))

  it('no owner, a deactivated owner or a non-marketing owner means Settings', () => {
    expect(contactNumbers(null, settings)).toEqual(settings)
    expect(contactNumbers({ ...rina, status: 'inactive' }, settings)).toEqual(settings)
    expect(contactNumbers({ ...rina, role: 'staff' }, settings)).toEqual(settings)
    expect(contactOwner({ ...rina, status: 'locked' })).toBeNull()
  })

  it('visitors never receive the raw numbers in the page data', () => {
    expect(PUBLIC_POSTER_FIELDS).not.toContain('ownerId')
    expect(PUBLIC_POSTER_FIELDS as readonly string[]).not.toContain('wa')
  })
})

describe('analytics per marketing user', () => {
  const users = [
    { id: 'm1', name: 'Rina', role: 'marketing' as const, status: 'active' as const },
    { id: 'm2', name: 'Budi', role: 'marketing' as const, status: 'active' as const },
    { id: 'm3', name: 'Sari', role: 'marketing' as const, status: 'active' as const },
    { id: 'm4', name: 'Lama', role: 'marketing' as const, status: 'inactive' as const },
    { id: 's1', name: 'Admin', role: 'super' as const, status: 'active' as const },
  ]
  const cards = [
    { code: 'CARD0001', ownerId: 'm1' },
    { code: 'CARD0002', ownerId: 'm2' },
    { code: 'CARD0003', ownerId: null },
  ]
  const posters = [
    { id: 'p1', kind: 'gambar' as const, ownerId: 'm1' },
    { id: 'p2', kind: 'gambar' as const, ownerId: 'm2' },
    { id: 'p3', kind: 'gambar' as const, ownerId: null },
    { id: 'a1', kind: 'pengumuman' as const, ownerId: 'm2' },
  ]
  const rows = [
    // Budi's poster gets clicks from Rina's card: the clicks count for Budi, the taps for Rina.
    { card: 'CARD0001', taps: 10, clicks: { 'p1|wa': 2, 'p2|wa': 5 } },
    { card: 'CARD0002', taps: 4, clicks: { 'p2|tel': 1 } },
    { card: 'CARD0003', taps: 3, clicks: { 'p3|wa': 1 } },
  ]
  const result = byMarketing(rows, cards, posters, users)

  it('ranks by clicks on their posters, with taps on their cards', () => {
    expect(result.slice(0, 2)).toEqual([
      { id: 'm2', name: 'Budi', cards: 1, posters: 1, taps: 4, clicks: 6 },
      { id: 'm1', name: 'Rina', cards: 1, posters: 1, taps: 10, clicks: 2 },
    ])
  })

  it('lists active marketers with nothing yet, but not other roles or idle ex-marketers', () => {
    expect(result.find(r => r.id === 'm3')).toMatchObject({ taps: 0, clicks: 0 })
    expect(result.some(r => r.id === 'm4' || r.id === 's1')).toBe(false)
  })

  it('puts what nobody owns in a last row', () =>
    expect(result.at(-1)).toEqual({
      id: null,
      name: 'Belum ada marketing',
      cards: 1,
      posters: 1,
      taps: 3,
      clicks: 1,
    }))

  it('totals match the overall counts', () => {
    expect(result.reduce((a, r) => a + r.taps, 0)).toBe(17)
    expect(result.reduce((a, r) => a + r.clicks, 0)).toBe(9)
  })
})
