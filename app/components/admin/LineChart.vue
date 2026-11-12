<script setup lang="ts">
// Hand-drawn SVG line chart: taps (solid) and clicks (dashed), with hover tooltip.
import { fmtDate, fmtDateShort, fmtNumber } from '#shared/utils/format'

const props = defineProps<{ days: { date: string; taps: number; clicks: number }[]; label: string; height?: number }>()

const W = 1000
const H = computed(() => props.height ?? 240)
const L = 44,
  R = 12,
  T = 12,
  B = 30
const max = computed(() => {
  const m = Math.max(4, ...props.days.map(d => d.taps))
  const exp = 10 ** Math.floor(Math.log10(m))
  const f = m / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
})
const x = (i: number) => L + (props.days.length <= 1 ? 0 : (i * (W - L - R)) / (props.days.length - 1))
const y = (v: number) => T + (H.value - T - B) * (1 - v / max.value)
const path = (k: 'taps' | 'clicks') => props.days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ')
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => max.value * f))
const every = computed(() => Math.max(1, Math.ceil(props.days.length / 7)))
const hover = ref<number | null>(null)
const totals = computed(() => props.days.reduce((a, d) => ({ taps: a.taps + d.taps, clicks: a.clicks + d.clicks }), { taps: 0, clicks: 0 }))

function onMove(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const r = svg.getBoundingClientRect()
  const px = ((e.clientX - r.left) / r.width) * W
  const i = Math.round((px - L) / ((W - L - R) / Math.max(1, props.days.length - 1)))
  hover.value = i >= 0 && i < props.days.length ? i : null
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${label}: total ${fmtNumber(totals.taps)} tap dan ${fmtNumber(totals.clicks)} klik.`"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g class="text-[11px]" fill="#52525b">
        <template v-for="t in ticks" :key="t">
          <line :x1="L" :x2="W - R" :y1="y(t)" :y2="y(t)" stroke="#f4f4f5" />
          <text :x="L - 8" :y="y(t) + 4" text-anchor="end">{{ fmtNumber(Math.round(t)) }}</text>
        </template>
        <template v-for="(d, i) in days" :key="d.date">
          <text v-if="i % every === 0" :x="x(i)" :y="H - 8" text-anchor="middle">{{ fmtDateShort(d.date) }}</text>
        </template>
      </g>
      <path :d="`${path('taps')} L${x(days.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`" fill="#2F318B" opacity=".06" />
      <path :d="path('taps')" fill="none" stroke="#2F318B" stroke-width="2.5" stroke-linejoin="round" />
      <path :d="path('clicks')" fill="none" stroke="#2494D2" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" />
      <g v-if="hover !== null">
        <line :x1="x(hover)" :x2="x(hover)" :y1="T" :y2="H - B" stroke="#2F318B" opacity=".2" />
        <circle :cx="x(hover)" :cy="y(days[hover]!.taps)" r="5" fill="#fff" stroke="#2F318B" stroke-width="2.5" />
        <circle :cx="x(hover)" :cy="y(days[hover]!.clicks)" r="5" fill="#fff" stroke="#2494D2" stroke-width="2.5" />
      </g>
    </svg>
    <div
      v-if="hover !== null"
      class="pointer-events-none absolute top-2 -translate-x-1/2 rounded-md bg-primary px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow"
      :style="{ left: `${(x(hover) / W) * 100}%` }"
    >
      <b>{{ fmtDate(days[hover]!.date) }}</b
      ><br />Tap {{ fmtNumber(days[hover]!.taps) }} · Klik {{ fmtNumber(days[hover]!.clicks) }}
    </div>
  </div>
</template>
