<script setup lang="ts">
// Editable list of short points (e.g. benefits), one input per point, with add and remove.
import { Plus, X } from '@lucide/vue'
import { POSTER_LIMITS } from '#shared/constants'

const points = defineModel<string[]>({ required: true })
defineProps<{ error?: string }>()

function set(i: number, value: string) {
  points.value = points.value.map((p, j) => (j === i ? value : p))
}
function remove(i: number) {
  points.value = points.value.filter((_, j) => j !== i)
}
function add() {
  if (points.value.length < POSTER_LIMITS.points) points.value = [...points.value, '']
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-[17px] font-semibold">
      Poin <span class="text-[15px] font-normal text-muted-foreground">(maksimal {{ POSTER_LIMITS.points }})</span>
    </legend>
    <div v-for="(p, i) in points" :key="i" class="flex items-center gap-2">
      <span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-[13px] font-black text-wa"
        >{{ i + 1 }}</span
      >
      <input
        :value="p"
        :aria-label="`Poin ${i + 1}`"
        :maxlength="POSTER_LIMITS.point"
        class="h-12 min-w-0 grow rounded-md border px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        @input="set(i, ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        :aria-label="`Hapus poin ${i + 1}`"
        class="flex size-12 shrink-0 items-center justify-center rounded-md border border-red-200 text-destructive hover:bg-red-50"
        @click="remove(i)"
      >
        <X class="size-5" />
      </button>
    </div>
    <button
      v-if="points.length < POSTER_LIMITS.points"
      type="button"
      class="flex min-h-12 items-center gap-2 self-start rounded-md border-2 border-dashed px-4 text-base font-semibold text-primary hover:bg-secondary"
      @click="add"
    >
      <Plus class="size-5" aria-hidden="true" />Tambah poin
    </button>
    <AdminFieldError id="points-err" :message="error" />
  </fieldset>
</template>
