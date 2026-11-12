<script setup lang="ts">
// Visual stand-in for a QR code (not scannable). Swap for a real QR library later.
const props = defineProps<{ seed: string; label: string; size?: number }>()
const cells = computed(() => {
  let s = [...props.seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 233280
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const out: { x: number; y: number }[] = []
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 28; x++) {
      if ((x < 10 && y < 10) || (x > 18 && y < 10) || (x < 10 && y > 18)) continue
      if (rnd() < 0.47) out.push({ x, y })
    }
  return out
})
</script>

<template>
  <svg viewBox="0 0 29 29" :width="size ?? 200" :height="size ?? 200" shape-rendering="crispEdges" role="img" :aria-label="label">
    <rect width="29" height="29" fill="#fff" />
    <rect v-for="c in cells" :key="`${c.x}-${c.y}`" :x="c.x" :y="c.y" width="1" height="1" fill="#09090b" />
    <g fill="none" stroke="#09090b">
      <rect x="2.5" y="2.5" width="6" height="6" />
      <rect x="20.5" y="2.5" width="6" height="6" />
      <rect x="2.5" y="20.5" width="6" height="6" />
    </g>
    <g fill="#09090b">
      <rect x="4" y="4" width="3" height="3" />
      <rect x="22" y="4" width="3" height="3" />
      <rect x="4" y="22" width="3" height="3" />
    </g>
  </svg>
</template>
