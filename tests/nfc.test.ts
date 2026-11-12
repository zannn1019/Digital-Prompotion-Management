import { describe, expect, it } from 'vitest'
import { nfcErrorInfo, nfcErrorReason } from '../app/utils/nfcErrors'

describe('Web NFC errors', () => {
  it('keeps the raw name and message for the debug panel', () => {
    expect(nfcErrorInfo(new DOMException('Failed to write due to an IO error: null', 'NetworkError'))).toEqual({
      name: 'NetworkError',
      message: 'Failed to write due to an IO error: null',
    })
    expect(nfcErrorInfo('boom')).toEqual({ name: 'Error', message: 'boom' })
  })

  // Seen on a real phone: Chrome raises NetworkError for a card that moved or is locked (read-only).
  // It used to fall into the generic "kartu tidak terbaca" message, which hid the likely cause.
  it('explains an IO error as a moved or locked card', () => {
    expect(nfcErrorReason('NetworkError')).toMatch(/bergeser.*terkunci/)
  })

  it('gives each known error its own message, and none for a cancel', () => {
    expect(nfcErrorReason('AbortError')).toBe('')
    expect(nfcErrorReason('NotAllowedError')).toMatch(/Izin NFC ditolak/)
    expect(nfcErrorReason('SecurityError')).toBe(nfcErrorReason('NotAllowedError'))
    expect(nfcErrorReason('NotSupportedError')).toMatch(/tidak mendukung/)
    expect(nfcErrorReason('InvalidStateError')).toMatch(/aplikasi lain/)
    expect(nfcErrorReason('SomethingNew')).toMatch(/tidak terbaca/)
  })
})
