import { describe, expect, it } from 'vitest'
import {
  HELPER_DOWNLOADS,
  cardForUrl,
  countsAsFailedWrite,
  helperPlatform,
  helperState,
  setupSteps,
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

describe('which helper to offer', () => {
  it('offers the Mac app on macOS and the Windows program elsewhere', () => {
    const mac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/142.0 Safari/537.36'
    const win =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0 Safari/537.36'
    const ipad = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
    expect(helperPlatform(mac)).toBe('mac')
    expect(helperPlatform(win)).toBe('windows')
    expect(helperPlatform(win, 'macOS')).toBe('mac')
    expect(helperPlatform(ipad)).toBe('windows')
    expect(HELPER_DOWNLOADS.mac.file).toBe('PenulisNFC-mac.zip')
  })

  it('gives each system its own setup, both ending with allowing the site', () => {
    expect(setupSteps('mac').join(' ')).toMatch(/Applications.*Open Anyway/)
    expect(setupSteps('windows').join(' ')).toMatch(/Run anyway/)
    for (const p of ['mac', 'windows'] as const)
      expect(setupSteps(p).at(-1)).toMatch(/Izinkan situs/)
  })
})
