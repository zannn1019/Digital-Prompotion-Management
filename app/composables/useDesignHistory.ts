import type { Ref } from 'vue'
import type { PosterDesign } from '#shared/design'

const LIMIT = 60

/**
 * Undo/redo for the canvas editor, as snapshots of the whole design.
 * Call `commit()` after each finished change (drag end, button press, text field blur).
 */
export function useDesignHistory(design: Ref<PosterDesign>, onCommit?: (d: PosterDesign) => void) {
  const past = ref<string[]>([JSON.stringify(design.value)])
  const future = ref<string[]>([])

  function commit() {
    const snap = JSON.stringify(design.value)
    if (snap === past.value.at(-1)) return
    past.value.push(snap)
    if (past.value.length > LIMIT) past.value.shift()
    future.value = []
    onCommit?.(design.value)
  }

  function restore(snap: string) {
    design.value = JSON.parse(snap)
    onCommit?.(design.value)
  }

  function undo() {
    if (past.value.length < 2) return
    future.value.push(past.value.pop()!)
    restore(past.value.at(-1)!)
  }

  function redo() {
    const next = future.value.pop()
    if (!next) return
    past.value.push(next)
    restore(next)
  }

  return {
    commit,
    undo,
    redo,
    canUndo: computed(() => past.value.length > 1),
    canRedo: computed(() => future.value.length > 0),
    /** True once anything changed since the editor opened. */
    changed: computed(() => past.value.length > 1 || future.value.length > 0),
  }
}
