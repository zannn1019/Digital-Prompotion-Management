<script setup lang="ts">
// A spare QR sticker (60 × 70 mm) for a card, for phones without NFC. Black on white only, so it always scans.
defineProps<{ code: string; label: string; url: string }>()
</script>

<template>
  <div class="sticker">
    <PosterQr :value="url" :label="`Kode QR kartu ${code}`" class="qr" />
    <b class="head">Pindai untuk info &amp; promo</b>
    <span class="where">{{ label }}</span>
    <span class="code">{{ code }}</span>
  </div>
</template>

<style scoped>
.sticker {
  box-sizing: border-box;
  width: 60mm;
  height: 70mm;
  padding: 4mm;
  border: 0.2mm dashed #9ca3af;
  background: #fff;
  color: #111827;
  font-family: Lato, system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sticker :deep(svg) {
  display: block;
  width: 42mm;
  height: 42mm;
}
.head {
  margin-top: 2.5mm;
  font-size: 9pt;
  font-weight: 900;
}
.where {
  margin-top: 0.8mm;
  font-size: 7pt;
  line-height: 1.25;
  max-width: 52mm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code {
  margin-top: auto;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 6.5pt;
  letter-spacing: 0.06em;
  color: #4b5563;
}
</style>
