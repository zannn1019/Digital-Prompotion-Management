<script setup lang="ts">
// Real, scannable QR code drawn as SVG on the server (no script, no network).
import { encode } from 'uqr'

const props = defineProps<{ value: string; label: string; size?: number }>()
const qr = computed(() => encode(props.value, { border: 2 }))
/** One path for all dark modules keeps the SVG small. */
const path = computed(() => qr.value.data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join(''))
</script>

<template>
  <svg
    :viewBox="`0 0 ${qr.size} ${qr.size}`"
    :width="size ?? 120"
    :height="size ?? 120"
    shape-rendering="crispEdges"
    role="img"
    :aria-label="label"
  >
    <rect :width="qr.size" :height="qr.size" fill="#fff" />
    <path :d="path" fill="#09090b" />
  </svg>
</template>
