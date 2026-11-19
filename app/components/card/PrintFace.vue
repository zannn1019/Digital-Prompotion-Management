<script setup lang="ts">
// One side of a printed NFC card, in real millimetres (size from CARD_PRINT).
// The design controls backgrounds and text only. The QR code is always black on a white tile, at a fixed
// size and place with its quiet zone, and always encodes this card's own address, so it stays scannable.
import type { CardDesign } from '#shared/types'
import { CARD_PRINT } from '#shared/constants'

const size = { width: `${CARD_PRINT.widthMm}mm`, height: `${CARD_PRINT.heightMm}mm` }

const props = defineProps<{
  side: 'front' | 'back'
  design: CardDesign
  code: string
  url: string
  logoUrl: string
  company: string
}>()

const bg = computed(() => {
  const color = props.side === 'front' ? props.design.frontBg : props.design.backBg
  const image = props.side === 'front' ? props.design.frontImage : props.design.backImage
  return image
    ? {
        backgroundColor: color,
        backgroundImage: `url("${image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: color }
})
const ink = computed(() => (props.design.ink === 'light' ? '#ffffff' : '#111827'))
</script>

<template>
  <div class="card-face" :style="{ ...size, ...bg, color: ink }">
    <template v-if="side === 'front'">
      <!-- A light plate keeps a coloured logo readable on any background. -->
      <div v-if="design.showLogo" class="logo" :class="design.ink === 'light' && 'plate'">
        <img :src="logoUrl" :alt="company" />
      </div>
      <div class="words">
        <b class="title">{{ design.title }}</b>
        <span class="subtitle">{{ design.subtitle }}</span>
      </div>
      <div class="qr-tile">
        <PosterQr :value="url" :label="`Kode QR kartu ${code}`" :size="76" class="qr" />
        <span class="code">{{ code }}</span>
      </div>
    </template>
    <template v-else>
      <div class="back">
        <svg class="nfc" viewBox="0 0 48 48" aria-hidden="true">
          <path
            d="M19 30a8 8 0 0 0 0-12M25.5 35a15 15 0 0 0 0-22M32 40a22 22 0 0 0 0-32"
            fill="none"
            stroke="currentColor"
            stroke-width="3.4"
            stroke-linecap="round"
          />
          <circle cx="12.5" cy="24" r="3.2" fill="currentColor" />
        </svg>
        <span class="caption">{{ design.backCaption }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.card-face {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  font-family: Lato, system-ui, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  border-radius: 10px;
}
.logo {
  position: absolute;
  top: 5.5mm;
  left: 6mm;
  display: flex;
  align-items: center;
}
.logo.plate {
  padding: 1.1mm 1.6mm;
  border-radius: 1.4mm;
  background: #fff;
}
.logo img {
  display: block;
  height: 7.6mm;
  width: auto;
  max-width: 44mm;
  object-fit: contain;
}
.words {
  position: absolute;
  left: 6mm;
  bottom: 6mm;
  /* Up to the QR tile (6mm edge + 29mm tile) with a 3mm gap, whatever the card width. */
  right: 38mm;
  display: flex;
  flex-direction: column;
  gap: 0.8mm;
}
.title {
  font-size: 11pt;
  line-height: 1.15;
  font-weight: 900;
  text-wrap: balance;
}
.subtitle {
  font-size: 7.4pt;
  line-height: 1.3;
  opacity: 0.92;
}
/* Fixed: size, place and colours of the QR never follow the design. */
.qr-tile {
  position: absolute;
  right: 6mm;
  top: 50%;
  transform: translateY(-50%);
  width: 29mm;
  padding: 1.6mm 1.6mm 1.1mm;
  border-radius: 1.6mm;
  background: #fff;
  color: #111827;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5mm;
}
.qr-tile :deep(svg) {
  display: block;
  width: 25.8mm;
  height: 25.8mm;
}
.code {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 6.4pt;
  letter-spacing: 0.06em;
}
.back {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.4mm;
}
.nfc {
  width: 18mm;
  height: 18mm;
}
.caption {
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.02em;
}
</style>
