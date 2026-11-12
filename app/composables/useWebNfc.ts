// Thin wrapper around Web NFC (Chrome on Android, https or localhost only).
// https://developer.mozilla.org/docs/Web/API/Web_NFC_API

interface NdefWriter {
  write: (message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal }) => Promise<void>
  makeReadOnly: (options?: { signal?: AbortSignal }) => Promise<void>
}

/** `stage` says which step failed: 'write' (nothing written) or 'lock' (the URL is on the card, locking it failed). */
export type NfcResult = { ok: true } | { ok: false; cancelled?: boolean; reason: string; stage?: 'write' | 'lock' }

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
    let stage: 'write' | 'lock' = 'write'
    try {
      const reader = new (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader()
      await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal: controller.signal })
      if (lock) {
        stage = 'lock'
        onLocking?.()
        await reader.makeReadOnly({ signal: controller.signal })
      }
      return { ok: true }
    } catch (e) {
      const { name } = nfcErrorInfo(e)
      if (name === 'AbortError') return { ok: false, cancelled: true, reason: '', stage }
      const reason =
        stage === 'lock'
          ? 'Alamat sudah tertulis, tetapi kartu gagal dikunci. Coba kunci lagi atau pakai kartu tanpa dikunci.'
          : nfcErrorReason(name)
      return { ok: false, reason, stage }
    } finally {
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  return { supported, secureContext, writeUrl, cancel }
}
