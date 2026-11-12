<script setup lang="ts">
// Horizontal bar chart drawn in SVG.
import { fmtNumber } from '#shared/utils/format'

const props = defineProps<{ items: { label: string; value: number }[]; title: string; color?: string }>()
const W = 480,
  ROW = 46
const max = computed(() => Math.max(1, ...props.items.map(i => i.value)))
</script>

<template>
  <svg
    v-if="items.length"
    :viewBox="`0 0 ${W} ${items.length * ROW}`"
    class="h-auto w-full"
    role="img"
    :aria-label="`${title}: ${items.map(i => `${i.label} ${i.value}`).join(', ')}`"
  >
    <g v-for="(it, i) in items" :key="it.label">
      <title>{{ it.label }}: {{ fmtNumber(it.value) }}</title>
      <text x="0" :y="i * ROW + 14" font-size="13" fill="#09090b">{{ it.label.length > 46 ? `${it.label.slice(0, 45)}…` : it.label }}</text>
      <text :x="W" :y="i * ROW + 14" font-size="13" font-weight="600" fill="#09090b" text-anchor="end">{{ fmtNumber(it.value) }}</text>
      <rect x="0" :y="i * ROW + 24" :width="W" height="10" rx="5" fill="#f4f4f5" />
      <rect x="0" :y="i * ROW + 24" :width="Math.max(4, (it.value / max) * W)" height="10" rx="5" :fill="color ?? '#2F318B'" />
    </g>
  </svg>
  <p v-else class="text-sm text-muted-foreground">Belum ada data pada rentang ini.</p>
</template>
