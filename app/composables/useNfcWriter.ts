// Talks to the Penulis NFC helper on this computer (see app/utils/nfcWriter.ts and tools/penulis-nfc).
// Polls its status while the page is open and visible; write/read wait for a card (up to 30 s in the helper).
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'
import {
  HELPER_URL,
  helperState,
  type HelperFailure,
  type HelperStatus,
  type ReadSuccess,
  type WriteSuccess,
} from '~/utils/nfcWriter'

const OFFLINE: HelperFailure = { ok: false, error: 'offline', message: '' }

async function call<T>(path: string, body?: object): Promise<T | HelperFailure> {
  try {
    const res = await fetch(HELPER_URL + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    return (await res.json()) as T | HelperFailure
  } catch {
    return OFFLINE
  }
}

export function useNfcWriter() {
  const status = ref<HelperStatus | null>(null)
  const failure = ref<HelperFailure | null>(null)
  const reachable = ref(true)
  const checked = ref(false)

  async function refresh() {
    const r = await call<HelperStatus>('/status')
    checked.value = true
    reachable.value = r !== OFFLINE
    if (r.ok) {
      status.value = r as HelperStatus
      failure.value = null
    } else {
      failure.value = r as HelperFailure
      status.value = null
    }
  }

  const state = computed(() =>
    checked.value ? helperState(status.value, failure.value, reachable.value) : 'checking',
  )

  // Poll every 2 s while the tab is visible (catches the helper starting, the reader being plugged in,
  // the site being allowed, a card being laid down, and what a running write waits for).
  const visible = useDocumentVisibility()
  const { pause, resume } = useIntervalFn(refresh, 2000, { immediate: false })
  watch(
    visible,
    v => {
      if (!import.meta.client) return
      if (v === 'visible') {
        refresh()
        resume()
      } else pause()
    },
    { immediate: true },
  )

  const working = ref<'write' | 'read' | null>(null)

  async function write(url: string, lock: boolean, skipUid?: string | null) {
    working.value = 'write'
    try {
      return await call<WriteSuccess>('/write', { url, lock, skipUid: skipUid ?? null })
    } finally {
      working.value = null
      refresh()
    }
  }

  async function read() {
    working.value = 'read'
    try {
      return await call<ReadSuccess>('/read', {})
    } finally {
      working.value = null
      refresh()
    }
  }

  function cancel() {
    void call('/cancel', {})
  }

  if (getCurrentScope()) onScopeDispose(() => working.value && cancel())

  return { status, state, working, refresh, write, read, cancel }
}
