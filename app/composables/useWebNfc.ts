// Thin wrapper around Web NFC (Chrome on Android, https only).
// https://developer.mozilla.org/docs/Web/API/Web_NFC_API

interface NdefWriter {
  write: (message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal }) => Promise<void>
  makeReadOnly: (options?: { signal?: AbortSignal }) => Promise<void>
}

export type NfcResult = { ok: true } | { ok: false; cancelled?: boolean; reason: string }

export function useWebNfc() {
  // The admin is client-rendered, so window is available here.
  const supported = ref(import.meta.client && 'NDEFReader' in window)
  let controller: AbortController | null = null

  /** Writes one URL record, then optionally locks the tag. Resolves when the tag accepted it. */
  async function writeUrl(url: string, lock: boolean, onLocking?: () => void): Promise<NfcResult> {
    controller = new AbortController()
    try {
      const reader = new (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader()
      await reader.write({ records: [{ recordType: 'url', data: url }] }, { signal: controller.signal })
      if (lock) {
        onLocking?.()
        await reader.makeReadOnly({ signal: controller.signal })
      }
      return { ok: true }
    } catch (e: any) {
      if (e?.name === 'AbortError') return { ok: false, cancelled: true, reason: '' }
      if (e?.name === 'NotAllowedError') return { ok: false, reason: 'Izin NFC ditolak. Izinkan NFC untuk situs ini di Chrome.' }
      return { ok: false, reason: 'Kartu bergeser sebelum selesai, atau kartu terkunci.' }
    } finally {
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  return { supported, writeUrl, cancel }
}
