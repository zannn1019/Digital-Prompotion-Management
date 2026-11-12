// Thin wrapper around Web NFC (Chrome on Android, https only).
// https://developer.mozilla.org/docs/Web/API/Web_NFC_API

interface NdefWriter {
  write: (message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal }) => Promise<void>
  makeReadOnly: (options?: { signal?: AbortSignal }) => Promise<void>
}

export type NfcResult = { ok: true } | { ok: false; cancelled?: boolean; reason: string }

export function useWebNfc() {
  const secureContext = ref(import.meta.client && window.isSecureContext)
  const supported = ref(secureContext.value && import.meta.client && 'NDEFReader' in window)
  let controller: AbortController | null = null

  /** Writes one URL record, then optionally locks the tag. Resolves when the tag accepted it. */
  async function writeUrl(url: string, lock: boolean, onLocking?: () => void): Promise<NfcResult> {
    if (!secureContext.value) {
      return { ok: false, reason: 'Halaman ini harus dibuka melalui alamat https untuk memakai NFC.' }
    }
    if (!supported.value) {
      return { ok: false, reason: 'Browser ini tidak mendukung Web NFC. Gunakan Google Chrome di Android.' }
    }
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol')
    } catch {
      return { ok: false, reason: 'Alamat kartu tidak valid. Periksa alamat situs sebelum menulis kartu.' }
    }

    controller = new AbortController()
    try {
      const reader = new (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader()
      await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal: controller.signal })
      if (lock) {
        onLocking?.()
        await reader.makeReadOnly({ signal: controller.signal })
      }
      return { ok: true }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'AbortError') return { ok: false, cancelled: true, reason: '' }
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return { ok: false, reason: 'Izin NFC ditolak. Izinkan NFC untuk situs ini di Chrome dan pastikan NFC menyala.' }
      }
      if (name === 'NotSupportedError') {
        return { ok: false, reason: 'HP atau kartu ini tidak mendukung penulisan NFC.' }
      }
      if (name === 'InvalidStateError') {
        return { ok: false, reason: 'NFC sedang dipakai aplikasi lain. Tutup aplikasi NFC lain, lalu coba lagi.' }
      }
      return { ok: false, reason: 'Kartu tidak terbaca. Tempelkan kartu di bagian belakang HP dan tahan selama 2–3 detik.' }
    } finally {
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  return { supported, secureContext, writeUrl, cancel }
}
