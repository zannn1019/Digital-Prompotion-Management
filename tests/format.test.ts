import { describe, expect, it } from 'vitest'
import type { Poster } from '#shared/types'
import { addDays, daysBetween, fmtDate, posterState, relDays } from '#shared/utils/format'
import { csvCell } from '~/utils/csv'
import { initials } from '~/utils/text'

const poster = (p: Partial<Poster>): Poster => ({
  id: 'p',
  kind: 'gambar',
  name: 'x',
  status: 'published',
  archived: false,
  start: '2026-10-01',
  end: '2026-10-31',
  updatedAt: '',
  updatedBy: '',
  ...p,
})

describe('posterState — only published posters inside their window are live', () => {
  it('is live within the schedule window', () => expect(posterState(poster({}), '2026-10-27')).toBe('tayang'))
  it('is live on the first and last day', () => {
    expect(posterState(poster({}), '2026-10-01')).toBe('tayang')
    expect(posterState(poster({}), '2026-10-31')).toBe('tayang')
  })
  it('is scheduled before the start', () =>
    expect(posterState(poster({ start: '2026-11-01', end: '2026-11-30' }), '2026-10-27')).toBe('terjadwal'))
  it('has ended after the end', () => expect(posterState(poster({}), '2026-11-01')).toBe('berakhir'))
  it('drafts never go live', () => expect(posterState(poster({ status: 'draft' }), '2026-10-27')).toBe('draft'))
  it('archive wins over everything', () => expect(posterState(poster({ archived: true }), '2026-10-27')).toBe('arsip'))
})

describe('date helpers', () => {
  it('formats in Indonesian', () => expect(fmtDate('2026-10-27')).toBe('27 Okt 2026'))
  it('adds days across months', () => expect(addDays('2026-10-30', 3)).toBe('2026-11-02'))
  it('counts days', () => expect(daysBetween('2026-10-27', '2026-10-31')).toBe(4))
  it('describes relative days', () => expect(relDays('2026-10-31')).toBe('dalam 4 hari'))
})

describe('csvCell', () => {
  it('quotes commas and quotes', () => expect(csvCell('a, "b"')).toBe('"a, ""b"""'))
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell('+62')).toBe("'+62")
  })
  it('keeps plain values', () => expect(csvCell(42)).toBe('42'))
})

describe('initials', () => {
  it('takes two letters', () => expect(initials('Rina Kartika Sari')).toBe('RK'))
  it('handles empty names', () => expect(initials(undefined)).toBe(''))
})
