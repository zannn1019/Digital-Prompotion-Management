<script setup lang="ts">
// The canvas editor: tools on the left, the poster in the middle, settings for
// the selected element on the right. Emits the finished design and its image.
import { useEventListener } from '@vueuse/core'
import { CircleAlert, CircleCheck, Minus, Plus, Redo2, Undo2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { MAX_ELEMENTS, READABLE_FONT, isLocked, smallestFont } from '#shared/design'
import type { DesignElement, PosterDesign } from '#shared/design'
import type { Settings } from '#shared/types'

const props = defineProps<{ initial: PosterDesign; brand: Settings; canOpenSettings: boolean; finishing?: boolean }>()
const emit = defineEmits<{ finish: [design: PosterDesign, image: Blob] }>()

const design = ref<PosterDesign>(structuredClone(toRaw(props.initial)))
const selectedId = ref<string | null>(null)
const history = useDesignHistory(design, d => designAutosave.write(d))
defineExpose({ changed: history.changed })

const selected = computed(() => design.value.elements.find(e => e.id === selectedId.value) ?? null)
const indexOf = (id: string) => design.value.elements.findIndex(e => e.id === id)

// Zoom: 40% fits a laptop screen; the export is always full size.
const ZOOMS = [0.3, 0.35, 0.4, 0.5, 0.6, 0.75]
const zoom = ref(2)
const scale = computed(() => ZOOMS[zoom.value]!)

function update(id: string, patch: Partial<DesignElement>, commit = true) {
  const el = design.value.elements[indexOf(id)]
  if (!el) return
  Object.assign(el, patch)
  if (commit) history.commit()
}

const limitReached = computed(() => design.value.elements.length >= MAX_ELEMENTS)
function add(el: DesignElement) {
  if (limitReached.value) return
  // New elements go below the locked brand blocks, which stay on top.
  const firstBrand = design.value.elements.findIndex(isLocked)
  design.value.elements.splice(firstBrand < 0 ? design.value.elements.length : firstBrand, 0, el)
  selectedId.value = el.id
  history.commit()
}

function act(action: 'forward' | 'backward' | 'duplicate' | 'delete') {
  const el = selected.value
  if (!el || isLocked(el)) return
  const els = design.value.elements
  const i = indexOf(el.id)
  if (action === 'delete') {
    els.splice(i, 1)
    selectedId.value = null
  } else if (action === 'duplicate') {
    if (limitReached.value) return
    const copy = { ...structuredClone(toRaw(el)), id: newId(), x: el.x + 30, y: el.y + 30 }
    els.splice(i + 1, 0, copy)
    selectedId.value = copy.id
  } else {
    const j = action === 'forward' ? i + 1 : i - 1
    if (j < 0 || j >= els.length) return
    ;[els[i], els[j]] = [els[j]!, els[i]!]
  }
  history.commit()
}

function setBackground(bg: { top: string; bottom: string }) {
  design.value.background = bg
  history.commit()
}

// Keyboard: Delete removes, Ctrl+Z / Ctrl+Y undo and redo, Esc deselects. Ignored while typing.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) history.redo()
    else history.undo()
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    history.redo()
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.value) {
    e.preventDefault()
    act('delete')
  } else if (e.key === 'Escape') selectedId.value = null
})

const minFont = computed(() => smallestFont(design.value))
const readable = computed(() => minFont.value === null || minFont.value >= READABLE_FONT)

const canvas = ref<{ exportBlob: () => Promise<Blob> }>()
const exportError = ref('')
async function finish() {
  exportError.value = ''
  selectedId.value = null
  try {
    emit('finish', structuredClone(toRaw(design.value)), await canvas.value!.exportBlob())
  } catch {
    exportError.value = 'Poster gagal disimpan sebagai gambar. Coba lagi, atau periksa koneksi.'
  }
}
</script>

<template>
  <div class="flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border bg-background">
    <div class="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="size-12"
        aria-label="Batalkan (Ctrl+Z)"
        :disabled="!history.canUndo.value"
        @click="history.undo()"
        ><Undo2 class="size-5"
      /></Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        class="size-12"
        aria-label="Ulangi (Ctrl+Y)"
        :disabled="!history.canRedo.value"
        @click="history.redo()"
        ><Redo2 class="size-5"
      /></Button>
      <div class="ml-2 flex items-center gap-1.5 text-sm">
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="size-10"
          aria-label="Perkecil tampilan"
          :disabled="zoom === 0"
          @click="zoom--"
          ><Minus class="size-4"
        /></Button>
        <span class="w-12 text-center tabular-nums" aria-live="polite">{{ Math.round(scale * 100) }}%</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="size-10"
          aria-label="Perbesar tampilan"
          :disabled="zoom === ZOOMS.length - 1"
          @click="zoom++"
          ><Plus class="size-4"
        /></Button>
      </div>
      <span class="ml-2 text-sm text-muted-foreground">HP 4:5 · 1080 × 1350</span>
      <span class="grow" />
      <span class="text-sm text-green-700">{{ history.changed.value ? 'Tersimpan otomatis di browser ini' : '' }}</span>
      <Button type="button" class="h-12 px-5 text-base" :disabled="finishing" @click="finish">{{
        finishing ? 'Menyimpan gambar…' : 'Selesai: lanjut lengkapi →'
      }}</Button>
    </div>
    <p v-if="exportError" class="border-b bg-red-50 px-4 py-2 text-[15px] font-semibold text-destructive" role="alert">{{ exportError }}</p>

    <div class="flex min-h-0 grow">
      <DesignTools :design="design" :selected-id="selectedId" @add="add" @background="setBackground" @select="selectedId = $event" />

      <main class="flex min-w-0 grow flex-col items-center gap-4 overflow-auto bg-zinc-100 p-6">
        <div class="rounded shadow-[0_12px_40px_rgba(0,0,0,.18)]">
          <DesignCanvas
            ref="canvas"
            :design="design"
            :brand="brand"
            :scale="scale"
            :selected-id="selectedId"
            @select="selectedId = $event"
            @change="(id, patch) => update(id, patch)"
          />
        </div>
        <div role="status" class="flex flex-wrap justify-center gap-2 text-[15px]">
          <span v-if="readable" class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-green-100 px-3 text-green-900">
            <CircleCheck class="size-4" aria-hidden="true" />Ukuran teks terbaca di HP
          </span>
          <span v-else class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-amber-950">
            <CircleAlert class="size-4" aria-hidden="true" />Teks terkecil {{ minFont }} px: mungkin sulit dibaca di HP. Disarankan minimal
            {{ READABLE_FONT }} px.
          </span>
          <span v-if="limitReached" class="inline-flex min-h-9 items-center rounded-full bg-amber-100 px-3 text-amber-950"
            >Batas {{ MAX_ELEMENTS }} elemen tercapai.</span
          >
        </div>
      </main>

      <DesignProperties
        :element="selected"
        :can-open-settings="canOpenSettings"
        @update="(patch, commit) => selected && update(selected.id, patch, commit)"
        @commit="history.commit()"
        @action="act"
      />
    </div>
  </div>
</template>
