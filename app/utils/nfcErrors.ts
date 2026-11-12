// Turns Web NFC errors into short Indonesian messages for the card writer.
// Pure logic (no Vue, no window), so tests can use it.

/** The error name and message from a Web NFC call. */
export interface NfcErrorInfo {
  name: string
  message: string
}

export function nfcErrorInfo(error: unknown): NfcErrorInfo {
  if (error && typeof error === 'object' && 'name' in error)
    return { name: String((error as { name: unknown }).name), message: String((error as { message?: unknown }).message ?? '') }
  return { name: 'Error', message: String(error) }
}

/** What to tell the person holding the phone. `AbortError` (cancelled) has no message. */
export function nfcErrorReason(name: string): string {
  switch (name) {
    case 'AbortError':
      return ''
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Izin NFC ditolak. Izinkan NFC untuk situs ini di Chrome dan pastikan NFC menyala.'
    case 'NotSupportedError':
      return 'HP atau kartu ini tidak mendukung penulisan NFC.'
    case 'InvalidStateError':
      return 'NFC sedang dipakai aplikasi lain. Tutup aplikasi NFC lain, lalu coba lagi.'
    // Chrome reports "Failed to write due to an IO error" when the card left the field mid-write,
    // and also for a card that is locked (read-only), which can never be written again.
    case 'NetworkError':
      return 'Kartu terbaca tetapi gagal ditulis: kartu bergeser saat ditulis, atau kartu sudah terkunci (tidak bisa ditulis ulang).'
    default:
      return 'Kartu tidak terbaca. Tempelkan kartu di bagian belakang HP dan tahan selama 2–3 detik.'
  }
}
