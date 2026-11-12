<script setup lang="ts">
// Brand colour picker: only the brand palette, so posters stay on-brand.
import { Check } from '@lucide/vue'
import { BRAND_COLORS } from '#shared/design'

const value = defineModel<string>({ required: true })
defineProps<{ label: string }>()
const emit = defineEmits<{ pick: [] }>()

function pick(v: string) {
  value.value = v
  emit('pick')
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-[15px] font-semibold">{{ label }}</legend>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in BRAND_COLORS"
        :key="c.value"
        type="button"
        :aria-label="c.name"
        :aria-pressed="value.toLowerCase() === c.value"
        :title="c.name"
        :class="[
          'flex size-11 items-center justify-center rounded-lg border',
          value.toLowerCase() === c.value ? 'ring-2 ring-zinc-900 ring-offset-2' : 'border-zinc-300',
        ]"
        :style="{ background: c.value }"
        @click="pick(c.value)"
      >
        <Check
          v-if="value.toLowerCase() === c.value"
          class="size-5"
          :class="['#ffffff', '#facc15', '#bae6fd'].includes(c.value) ? 'text-zinc-900' : 'text-white'"
          aria-hidden="true"
        />
      </button>
    </div>
  </fieldset>
</template>
