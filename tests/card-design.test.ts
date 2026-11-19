import { describe, expect, it } from 'vitest'
import { cardDesignSchema, settingsSchema } from '../server/utils/validation'
import { DEFAULT_SETTINGS } from '../server/db/defaults'
import { CARD_PRINT } from '#shared/constants'

const base = DEFAULT_SETTINGS.cardDesign

describe('printed card design', () => {
  it('accepts the standard design and saves through the settings', () => {
    expect(cardDesignSchema.safeParse(base).success).toBe(true)
    expect(settingsSchema.safeParse({ cardDesign: base }).success).toBe(true)
  })

  it('takes background images only from this app’s uploads', () => {
    const own = '/api/uploads/f' + 'a'.repeat(32)
    expect(cardDesignSchema.safeParse({ ...base, frontImage: own }).success).toBe(true)
    for (const bad of [
      'https://evil.test/bg.png',
      'javascript:alert(1)',
      '/api/uploads/x") ; color:red',
    ])
      expect(cardDesignSchema.safeParse({ ...base, backImage: bad }).success).toBe(false)
  })

  it('takes only #rrggbb colours, so nothing else can reach the card style', () => {
    expect(cardDesignSchema.safeParse({ ...base, frontBg: '#00a2e9' }).success).toBe(true)
    for (const bad of ['red', '#fff', 'url(x)', '#2F318B;position:fixed'])
      expect(cardDesignSchema.safeParse({ ...base, frontBg: bad }).success).toBe(false)
  })

  it('has no setting for the QR code, and refuses unknown keys', () => {
    expect(cardDesignSchema.safeParse({ ...base, qrColor: '#ff0000' }).success).toBe(false)
    expect(cardDesignSchema.safeParse({ ...base, qrSize: 10 }).success).toBe(false)
  })

  it('limits the text to what fits on the card', () => {
    const long = 'x'.repeat(CARD_PRINT.limits.title + 1)
    expect(cardDesignSchema.safeParse({ ...base, title: long }).success).toBe(false)
    expect(cardDesignSchema.safeParse({ ...base, ink: 'blue' }).success).toBe(false)
  })
})
