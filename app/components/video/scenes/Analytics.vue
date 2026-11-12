<script setup lang="ts">
// Scene 6 · Analitik: the real analytics page. Totals count up, the daily chart draws left to right,
// then the camera moves down to the bar lists as they grow.
import Analitik from '~/pages/admin/analitik.vue'
import { EASE, type VideoScene } from '~/video/timeline'
import { cam, countUp, revealWords } from '~/video/motion'
import { until } from '~/video/until'

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const qa = (s: string) => Array.from(root.value!.querySelectorAll(s)) as HTMLElement[]

defineExpose<VideoScene & { ready: () => Promise<void> }>({
  ready: () => until(() => qa('.video-window-body .text-2xl').length >= 3 && !!root.value!.querySelector('svg[role="img"]')),
  build(tl, at) {
    const layer = q('.va-cam')
    tl.fromTo(layer, cam(1020, 400, 1.32), { ...cam(1020, 420, 1.34), duration: 3.4, ease: 'none' }, at)
    tl.to(layer, { ...cam(1020, 760, 1.3), duration: 1.2, ease: EASE.move }, at + 3.6)
    qa('.video-window-body .text-2xl').forEach((el, i) => countUp(tl, el, at + 0.2 + i * 0.12, 1.6))
    // the chart reveals from left to right, like a line being drawn
    tl.fromTo(
      q('svg[role="img"]'),
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 2.4, ease: 'power1.inOut' },
      at + 0.6,
    )
    const bars = qa('.video-window-body rect').filter(r => r.getAttribute('fill') !== '#f4f4f5')
    tl.fromTo(bars, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.9, ease: EASE.in, stagger: 0.06 }, at + 3.9)
    tl.fromTo(q('.video-cap'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.in }, at + 4.6)
    revealWords(tl, q('.video-line'), at + 4.7)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="va-cam absolute inset-0 origin-top-left">
      <VideoWindow class="left-[240px] top-[90px]" :height="1300" title="Analitik"><Analitik /></VideoWindow>
    </div>
    <div class="video-cap bottom-[70px] left-[80px] max-w-[760px]">
      <div class="video-kicker">Analitik &amp; laporan</div>
      <p class="video-line">Tahu poster mana yang bekerja</p>
    </div>
    <div class="video-demo">Data contoh</div>
  </div>
</template>
