// Short names and avatar initials on the dashboard and menus: titles such as "dr." are not a first name.
import { describe, expect, it } from 'vitest'
import { initials, shortName } from '~/utils/text'

describe('names', () => {
  it('addresses people by first name, keeping a leading title', () => {
    expect(shortName('Rina Kartika')).toBe('Rina')
    expect(shortName('dr. Hendra Wijaya')).toBe('dr. Hendra')
    expect(shortName('Prof. dr. Ani')).toBe('Prof. dr. Ani')
    expect(shortName('Admin')).toBe('Admin')
    expect(shortName(undefined)).toBe('')
  })

  it('builds initials from the name, not the title', () => {
    expect(initials('Rina Kartika')).toBe('RK')
    expect(initials('dr. Hendra Wijaya')).toBe('HW')
    expect(initials('Admin')).toBe('A')
    expect(initials(null)).toBe('')
  })
})
