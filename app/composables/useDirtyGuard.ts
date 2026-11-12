import { useEventListener } from '@vueuse/core'

/**
 * Tracks unsaved changes to a form and asks before leaving the page.
 * Call `markSaved()` after a successful save.
 */
export function useDirtyGuard(source: () => object) {
  const dirty = ref(false)
  watch(
    source,
    () => {
      dirty.value = true
    },
    { deep: true },
  )

  function markSaved() {
    dirty.value = false
  }

  onBeforeRouteLeave(() => {
    if (dirty.value && !window.confirm('Tinggalkan tanpa menyimpan? Perubahan yang belum disimpan akan hilang.')) return false
  })
  if (import.meta.client)
    useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
      if (dirty.value) e.preventDefault()
    })

  return { dirty, markSaved }
}
