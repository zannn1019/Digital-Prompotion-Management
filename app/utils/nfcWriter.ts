// The Penulis NFC helper (tools/penulis-nfc): a tray / menu-bar program on the Windows PC or Mac with the
// USB NFC reader (ACR122U). The admin page talks to it on localhost. Pure types and logic here (no Vue, no
// fetch), so tests can use it.

export const HELPER_URL = 'http://localhost:47811'

export type HelperPlatform = 'windows' | 'mac'

/** Which helper to offer: the Mac app on macOS, else the Windows program. */
export function helperPlatform(userAgent: string, platform = ''): HelperPlatform {
  const s = `${platform} ${userAgent}`
  return /mac/i.test(s) && !/iphone|ipad|ipod/i.test(s) ? 'mac' : 'windows'
}

export const HELPER_DOWNLOADS: Record<HelperPlatform, { href: string; file: string }> = {
  windows: { href: '/downloads/PenulisNFC.exe', file: 'PenulisNFC.exe' },
  mac: { href: '/downloads/PenulisNFC-mac.zip', file: 'PenulisNFC-mac.zip' },
}

/** Where the helper's icon is, in a sentence. */
export function trayPlace(p: HelperPlatform): string {
  return p === 'mac' ? 'bilah menu (kanan atas layar)' : 'taskbar (dekat jam)'
}

/** One-time setup on this computer. */
export function setupSteps(p: HelperPlatform): string[] {
  const last = 'Saat Penulis NFC bertanya “Izinkan situs?”, klik Izinkan.'
  return p === 'mac'
    ? [
        'Unduh PenulisNFC-mac.zip, buka, lalu pindahkan Penulis NFC ke folder Applications.',
        'Buka Penulis NFC. Bila macOS menolak membukanya, buka System Settings → Privacy & Security, lalu klik Open Anyway.',
        'Colokkan pembaca ACR122U ke USB. Pakai Chrome atau Edge (bukan Safari).',
        last,
      ]
    : [
        'Unduh dan jalankan PenulisNFC.exe di komputer yang dipakai menulis.',
        'Bila muncul “Windows protected your PC”, klik More info → Run anyway.',
        'Colokkan pembaca ACR122U ke USB.',
        last,
      ]
}

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
    return 'Penulis NFC tidak menjawab. Pastikan programnya berjalan (ada ikonnya di taskbar atau bilah menu), lalu coba lagi.'
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
