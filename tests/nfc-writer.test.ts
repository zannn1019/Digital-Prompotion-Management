import { describe, expect, it } from 'vitest'
import {
  cardForUrl,
  countsAsFailedWrite,
  helperState,
  writerErrorMessage,
  type HelperStatus,
} from '../app/utils/nfcWriter'

const status = (reader: string | null): HelperStatus => ({
  ok: true,
  app: 'penulis-nfc',
  version: '1.0.0',
  service: !!reader,
  readers: reader ? [reader] : [],
  reader,
  card: false,
  busy: false,
  waiting: null,
})

describe('Penulis NFC helper state', () => {
  it('is offline when the helper does not answer', () => {
    expect(helperState(null, null, false)).toBe('offline')
  })

  it('tells "asking" (question on screen) apart from "denied"', () => {
    const notAllowed = { ok: false as const, error: 'not_allowed', message: '' }
    expect(helperState(null, { ...notAllowed, asking: true }, true)).toBe('asking')
    expect(helperState(null, { ...notAllowed, asking: false }, true)).toBe('denied')
  })

  it('needs a reader to be ready', () => {
    expect(helperState(status(null), null, true)).toBe('no-reader')
    expect(helperState(status('ACS ACR122 0'), null, true)).toBe('ready')
  })
})

describe('failed writes', () => {
  // Only a write that went wrong on a card marks it "Gagal"; giving up before touching a card does not.
  it('marks the card only when the card itself failed', () => {
    for (const e of ['cancelled', 'timeout', 'no_reader', 'reader_in_use', 'busy', 'offline'])
      expect(countsAsFailedWrite(e)).toBe(false)
    for (const e of [
      'card_removed',
      'write_failed',
      'verify_failed',
      'read_only',
      'too_small',
      'io',
    ])
      expect(countsAsFailedWrite(e)).toBe(true)
  })

  it('uses the helper message, with its own text when the helper is gone and none for a cancel', () => {
    expect(writerErrorMessage({ error: 'read_only', message: 'Kartu ini sudah terkunci.' })).toBe(
      'Kartu ini sudah terkunci.',
    )
    expect(writerErrorMessage({ error: 'offline', message: '' })).toMatch(/tidak menjawab/)
    expect(writerErrorMessage({ error: 'cancelled', message: 'Dibatalkan.' })).toBe('')
  })
})

describe('checking a card', () => {
  const cards = [
    { code: 'AAA11111', url: 'https://poster.test/k/AAA11111' },
    { code: 'BBB22222', url: 'https://poster.test/k/BBB22222' },
  ]
  it('finds the card whose address is on it, ignoring case and a trailing slash', () => {
    expect(cardForUrl(cards, 'https://POSTER.test/k/BBB22222/')?.code).toBe('BBB22222')
    expect(cardForUrl(cards, 'https://other.test/k/BBB22222')).toBeUndefined()
    expect(cardForUrl(cards, null)).toBeUndefined()
  })
})
