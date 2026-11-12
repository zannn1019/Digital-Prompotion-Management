import { describe, expect, it } from 'vitest'
import { designText, smallestFont } from '../shared/design'
import { STARTERS, makeLabel, makePhoto, makeText } from '../app/utils/designStarters'
import { designSchema, imagePosterSchema } from '../server/utils/validation'

const paket = () => STARTERS.find(s => s.id === 'paket')!.make()

describe('canvas design validation', () => {
  it('accepts every starter design', () => {
    for (const s of STARTERS) expect(designSchema.safeParse(s.make()).success, s.id).toBe(true)
  })

  it('accepts a poster that carries its design, and one that clears it', () => {
    const poster = {
      kind: 'gambar',
      status: 'draft',
      name: 'Sleep Lab',
      title: 'Sleep Lab',
      imageUrl: '/api/uploads/f0123456789abcdef0123456789abcdef',
      description: 'Sleep Lab',
      buttons: [],
      start: '2026-10-01',
      end: '2026-10-31',
    }
    expect(imagePosterSchema.safeParse({ ...poster, design: paket() }).success).toBe(true)
    expect(imagePosterSchema.safeParse({ ...poster, design: null }).success).toBe(true)
  })

  it('only allows photos from our own uploads', () => {
    for (const src of ['https://evil.test/a.png', 'javascript:alert(1)', '/api/uploads/../x'])
      expect(designSchema.safeParse({ ...paket(), elements: [makePhoto({ src })] }).success).toBe(false)
  })

  it('rejects unreadable fonts, non-hex colours and unknown fields', () => {
    expect(designSchema.safeParse({ ...paket(), elements: [makeText({ text: 'x', fontSize: 10 })] }).success).toBe(false)
    expect(designSchema.safeParse({ ...paket(), elements: [makeLabel({ text: 'x', fill: 'red;}' })] }).success).toBe(false)
    expect(designSchema.safeParse({ ...paket(), elements: [{ ...makeText({ text: 'x' }), onclick: 'x' }] }).success).toBe(false)
  })

  it('limits the number of elements', () => {
    const elements = Array.from({ length: 61 }, () => makeText({ text: 'x' }))
    expect(designSchema.safeParse({ ...paket(), elements }).success).toBe(false)
  })
})

describe('design helpers', () => {
  it('reads text top to bottom for the text version of the poster', () => {
    const d = {
      ...paket(),
      elements: [makeText({ text: 'Bawah', y: 900 }), makeLabel({ text: 'Tengah', y: 500 }), makeText({ text: 'Atas', y: 100 })],
    }
    expect(designText(d)).toBe('Atas\nTengah\nBawah')
  })

  it('finds the smallest font for the readability check', () => {
    expect(smallestFont(paket())).toBe(42)
    expect(smallestFont({ ...paket(), elements: [] })).toBeNull()
  })
})
