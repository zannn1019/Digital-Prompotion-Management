import { describe, expect, it } from 'vitest'
import {
  MAX_ANALYTICS_DAYS,
  MAX_EXTEND_DAYS,
  analyticsQuerySchema,
  cardBulkSchema,
  extendEndProblem,
  imagePosterSchema,
  pageCreateSchema,
  posterSchema,
  settingsSchema,
  userPatchSchema,
} from '../server/utils/validation'
import { db } from '../server/utils/db'
import { SEED_ADMIN } from '../server/db/defaults'

const validImage = {
  kind: 'gambar',
  status: 'draft',
  name: 'Promo',
  imageUrl: '/api/uploads/f0123456789abcdef0123456789abcdef',
  title: 'MCU Basic Hemat 30%',
  description: 'Promo MCU',
  buttons: ['wa'],
  start: '2026-10-01',
  end: '2026-10-31',
}

describe('poster validation', () => {
  it('accepts a valid image poster', () => expect(imagePosterSchema.safeParse(validImage).success).toBe(true))

  it('rejects unknown fields (no mass assignment)', () => {
    const r = imagePosterSchema.safeParse({ ...validImage, archived: true, updatedBy: 'u1' })
    expect(r.success).toBe(false)
  })

  it('only accepts images from our own upload route', () => {
    for (const url of ['javascript:alert(1)', 'https://evil.test/x.png', '/api/uploads/../secret'])
      expect(imagePosterSchema.safeParse({ ...validImage, imageUrl: url }).success).toBe(false)
  })

  it('requires the text version of the poster', () => {
    const r = imagePosterSchema.safeParse({ ...validImage, description: '  ' })
    expect(r.success).toBe(false)
  })

  it('rejects an end date before the start', () => {
    const r = imagePosterSchema.safeParse({ ...validImage, end: '2026-09-01' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['end'])
  })

  it('limits announcements to 140 characters', () => {
    const base = { kind: 'pengumuman', status: 'published', level: 'penting', start: '2026-10-01', end: '2026-10-02' }
    expect(posterSchema.safeParse({ ...base, text: 'x'.repeat(140) }).success).toBe(true)
    expect(posterSchema.safeParse({ ...base, text: 'x'.repeat(141) }).success).toBe(false)
  })
})

describe('other schemas', () => {
  it('cannot set a user to locked directly', () => expect(userPatchSchema.safeParse({ status: 'locked' }).success).toBe(false))
  it('rejects malformed card codes', () => expect(cardBulkSchema.safeParse({ action: 'map', codes: ['abc'] }).success).toBe(false))
  it('requires https links in settings', () => {
    expect(settingsSchema.safeParse({ brochure: 'http://x.test/a.pdf' }).success).toBe(false)
    expect(settingsSchema.safeParse({ brochure: 'https://x.test/a.pdf' }).success).toBe(true)
  })
  it('rejects settings fields that are not editable', () =>
    expect(settingsSchema.safeParse({ baseUrl: 'https://evil.test/' }).success).toBe(false))
})

describe('visitor-page details', () => {
  it('requires a public title', () => {
    expect(imagePosterSchema.safeParse({ ...validImage, title: '' }).success).toBe(false)
  })

  it('accepts the optional details, and allows them to be empty', () => {
    const full = {
      ...validImage,
      category: 'paket',
      price: 'Rp 3.100.000',
      priceUnit: 'pemeriksaan',
      listTitle: 'Manfaat',
      points: ['A', 'B'],
      terms: 'Dengan perjanjian.',
      brochureUrl: '/api/uploads/ffedcba9876543210fedcba9876543210',
      brochureFile: 'brosur.pdf',
    }
    expect(imagePosterSchema.safeParse(full).success).toBe(true)
    expect(imagePosterSchema.safeParse({ ...validImage, price: '', points: [], brochureUrl: null }).success).toBe(true)
  })

  it('limits the list to 6 points and rejects unknown categories', () => {
    expect(imagePosterSchema.safeParse({ ...validImage, points: Array.from({ length: 7 }, () => 'x') }).success).toBe(false)
    expect(imagePosterSchema.safeParse({ ...validImage, category: 'lainnya' }).success).toBe(false)
  })

  it('only links brochures and logos that we host', () => {
    expect(imagePosterSchema.safeParse({ ...validImage, brochureUrl: 'https://evil.test/a.pdf' }).success).toBe(false)
    expect(settingsSchema.safeParse({ logoUrl: '/brand/logo.png' }).success).toBe(true)
    expect(settingsSchema.safeParse({ logoUrl: 'https://evil.test/logo.png' }).success).toBe(false)
  })
})

describe('analytics date range', () => {
  const failsOn = (q: Record<string, unknown>) => {
    const r = analyticsQuerySchema.safeParse(q)
    return r.success ? null : r.error.issues[0]?.path[0]
  }

  it('defaults to the last 30 days, and treats emptied fields as defaults', () => {
    expect(analyticsQuerySchema.parse({})).toEqual({ from: '2026-09-28', to: '2026-10-27' })
    expect(analyticsQuerySchema.parse({ from: '', to: '' })).toEqual({ from: '2026-09-28', to: '2026-10-27' })
    expect(analyticsQuerySchema.parse({ to: '2026-10-10' })).toEqual({ from: '2026-09-11', to: '2026-10-10' })
  })

  it('accepts a range up to the limit', () => {
    expect(analyticsQuerySchema.parse({ from: '2026-10-27', to: '2026-10-27' })).toEqual({ from: '2026-10-27', to: '2026-10-27' })
    expect(analyticsQuerySchema.safeParse({ from: '2025-10-27', to: '2026-10-27' }).success).toBe(true) // 366 days
  })

  // Regression: `to=z` used to loop forever and hang the whole server.
  it('rejects values that are not real calendar dates', () => {
    for (const to of ['z', '9999', '2026-02-30', '2026-13-01', '2026-10-27T00:00', ['2026-10-01', '2026-10-02']])
      expect(failsOn({ to })).toBe('to')
    expect(failsOn({ from: 'x' })).toBe('from')
  })

  it('rejects a reversed range and one longer than the limit', () => {
    expect(failsOn({ from: '2026-10-28', to: '2026-10-27' })).toBe('from')
    expect(failsOn({ from: '2025-10-26', to: '2026-10-27' })).toBe('from') // 367 days
    expect(failsOn({ from: '2000-01-01', to: '9999-12-31' })).toBe('from')
    expect(MAX_ANALYTICS_DAYS).toBe(366)
  })
})

describe('new page', () => {
  it('needs a name and nothing else', () => {
    expect(pageCreateSchema.safeParse({ name: 'Poster PT Contoh Logam' }).success).toBe(true)
    expect(pageCreateSchema.safeParse({ name: '  ' }).success).toBe(false)
    expect(pageCreateSchema.safeParse({ name: 'X', isDefault: true }).success).toBe(false)
  })
})

describe('"Perpanjang" end date', () => {
  it('must be after the current end', () => {
    expect(extendEndProblem('2026-10-31', '2026-10-31')).toBe('Pilih tanggal setelah 31 Okt 2026.')
    expect(extendEndProblem('2026-10-31', '2026-10-01')).toBe('Pilih tanggal setelah 31 Okt 2026.')
  })
  it('accepts the quick options and up to a year more', () => {
    for (const end of ['2026-11-07', '2026-11-30', '2027-11-01']) expect(extendEndProblem('2026-10-31', end)).toBeNull()
    expect(MAX_EXTEND_DAYS).toBe(366)
  })
  // Regression: any later date was accepted, e.g. 9999-12-31 kept a poster live forever.
  it('refuses more than a year past the current end', () => {
    expect(extendEndProblem('2026-10-31', '2027-11-02')).toBe('Maksimal 1 tahun setelah 31 Okt 2026.')
    expect(extendEndProblem('2026-10-31', '9999-12-31')).toBe('Maksimal 1 tahun setelah 31 Okt 2026.')
  })
})

describe('seed data', () => {
  // Seeded posters skip the API, so check them against the same rules the edit form uses:
  // a seeded poster that breaks a limit could not be saved again from the admin.
  it('every seeded image poster passes the poster schema', () => {
    const fields = [
      'kind',
      'status',
      'start',
      'end',
      'name',
      'imageUrl',
      'description',
      'buttons',
      'title',
      'category',
      'price',
      'priceUnit',
      'listTitle',
      'points',
      'terms',
    ] as const
    for (const p of db.posters.filter(p => p.kind === 'gambar')) {
      const body = Object.fromEntries(fields.filter(k => p[k] !== undefined).map(k => [k, p[k]]))
      const r = imagePosterSchema.safeParse(body)
      expect(r.success ? '' : JSON.stringify(r.error.issues[0]), p.id).toBe('')
    }
  })

  it('starts empty, with one Super Admin on a reserved domain for the database seed', () => {
    expect(SEED_ADMIN).toEqual({ name: 'Admin', email: 'admin@rs-bethesda.test', role: 'super' })
    expect([db.posters.length, db.pages.length, db.cards.length, db.daily.length]).toEqual([0, 0, 0, 0])
  })
})
