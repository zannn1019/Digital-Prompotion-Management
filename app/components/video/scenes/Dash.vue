<script setup lang="ts">
// Scene 2 · Beranda: the real dashboard rises, the camera eases onto the four statistics and they count up.
import AdminHome from '~/pages/admin/index.vue'
import { EASE, type VideoScene } from '~/video/timeline'
import { cam, countUp, revealWords } from '~/video/motion'
import { until } from '~/video/until'

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const kpis = () => Array.from(root.value!.querySelectorAll('.video-window-body .text-3xl')) as HTMLElement[]

defineExpose<VideoScene & { ready: () => Promise<void> }>({
  ready: () => until(() => kpis().length === 4),
  build(tl, at) {
    const layer = q('.vd-cam')
    tl.fromTo(layer, cam(960, 560, 0.86), { ...cam(990, 430, 1.28), duration: 1.7, ease: EASE.move }, at + 0.4)
    tl.to(layer, { ...cam(990, 430, 1.31), duration: 2.9, ease: 'none' }, at + 2.1)
    tl.fromTo(q('.video-window'), { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1, ease: EASE.in }, at - 0.01)
    kpis().forEach((el, i) => countUp(tl, el, at + 1.0 + i * 0.18, 1.8))
    tl.fromTo(q('.video-cap'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.in }, at + 2.8)
    revealWords(tl, q('.video-line'), at + 2.9)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="vd-cam absolute inset-0 origin-top-left">
      <VideoWindow class="left-[240px] top-[90px]" title="Beranda"><AdminHome /></VideoWindow>
    </div>
    <div class="video-cap bottom-[70px] left-[80px]">
      <div class="video-kicker">Beranda</div>
      <p class="video-line">Kinerja promosi, sekilas pandang</p>
    </div>
    <div class="video-demo">Data contoh</div>
  </div>
</template>
