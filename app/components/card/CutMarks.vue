<script setup lang="ts">
// Crop marks around the 2 × 4 card grid on an A4 sheet, drawn in the margins only (never on a card).
import { CARD_PRINT } from '#shared/constants'

const W = CARD_PRINT.widthMm
const H = CARD_PRINT.heightMm
const left = (210 - CARD_PRINT.cols * W) / 2
const top = (297 - CARD_PRINT.rows * H) / 2
const xs = Array.from({ length: CARD_PRINT.cols + 1 }, (_, i) => left + i * W)
const ys = Array.from({ length: CARD_PRINT.rows + 1 }, (_, i) => top + i * H)
const GAP = 1.5 // space between a mark and the card edge
</script>

<template>
  <svg class="marks" viewBox="0 0 210 297" aria-hidden="true">
    <g stroke="#000" stroke-width="0.15">
      <template v-for="x in xs" :key="`x${x}`">
        <line :x1="x" :x2="x" :y1="2" :y2="top - GAP" />
        <line :x1="x" :x2="x" :y1="297 - top + GAP" :y2="295" />
      </template>
      <template v-for="y in ys" :key="`y${y}`">
        <line :y1="y" :y2="y" :x1="3" :x2="left - GAP" />
        <line :y1="y" :y2="y" :x1="210 - left + GAP" :x2="207" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.marks {
  position: absolute;
  inset: 0;
  width: 210mm;
  height: 297mm;
  pointer-events: none;
}
</style>
