// The Penulis NFC helper (tools/penulis-nfc): a tray program on the PC with the USB NFC reader (ACR122U).
// The admin page talks to it on localhost. Pure types and logic here (no Vue, no fetch), so tests can use it.

export const HELPER_URL = 'http://localhost:47811'
export const HELPER_DOWNLOAD = '/downloads/PenulisNFC.exe'

/** GET /status from the helper. */
export interface HelperStatus {
  ok: boolean
  app: 'penulis-nfc'
  version: string
  service: boolean
  readers: string[]
  reader: string | null
  card: boolean
  busy: boolean
  /** What a running write waits for. */
  waiting: 'card' | 'remove_previous' | null
}

export interface HelperFailure {
  ok: false
  error: string
  message: string
  /** On 403: the "allow this site?" question is on the PC's screen now. */
  asking?: boolean
}

export interface WriteSuccess {
  ok: true
  uid: string
  type: string
  url: string
  locked: boolean
  /** Why the card was not locked although that was asked. */
  lockSkipped: string | null
}

export interface ReadSuccess {
  ok: true
  uid: string
  type: string
  url: string | null
  readOnly: boolean
  dataBytes: number
}

/**
 * Where the page stands with the helper:
 * - offline: not installed or not running on this computer
 * - asking: the "allow this site?" question is open on screen
 * - denied: the site was refused in the helper
 * - no-reader: running, but no reader plugged in
 * - ready: reader connected
 */
export type HelperState = 'checking' | 'offline' | 'asking' | 'denied' | 'no-reader' | 'ready'

export function helperState(
  status: HelperStatus | null,
  failure: HelperFailure | null,
  reachable: boolean,
): HelperState {
  if (!reachable) return 'offline'
  if (failure?.error === 'not_allowed') return failure.asking ? 'asking' : 'denied'
  if (!status) return 'checking'
  return status.reader ? 'ready' : 'no-reader'
}

/** Failures that are not about the card itself: the card was never touched, so no "failed" mark. */
const NOT_A_CARD_FAILURE = new Set([
  'cancelled',
  'timeout',
  'no_reader',
  'reader_in_use',
  'busy',
  'not_allowed',
  'bad_request',
  'offline',
])

/** Whether a failed write should mark the card "Gagal" (it was on the reader and the write went wrong). */
export function countsAsFailedWrite(error: string): boolean {
  return !NOT_A_CARD_FAILURE.has(error)
}

/** The message for a failed write or read. The helper already speaks Indonesian; this covers the page's own cases. */
export function writerErrorMessage(failure: Pick<HelperFailure, 'error' | 'message'>): string {
  if (failure.error === 'offline')
    return 'Penulis NFC tidak menjawab. Pastikan programnya berjalan (ikon di taskbar), lalu coba lagi.'
  if (failure.error === 'cancelled') return ''
  return failure.message || 'Kartu belum tertulis. Coba lagi.'
}

/** The card in the list whose address is on a scanned card, if any. */
export function cardForUrl<T extends { url: string }>(
  cards: T[],
  url: string | null,
): T | undefined {
  if (!url) return undefined
  const norm = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase()
  return cards.find(c => norm(c.url) === norm(url))
}
