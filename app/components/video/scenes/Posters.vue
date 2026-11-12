<script setup lang="ts">
// Scene 3 · Kelola poster: the real poster list fills row by row, then the real upload form,
// with a spotlight moving from the poster file to the title while it is typed.
import PosterList from '~/pages/admin/poster/index.vue'
import PosterNew from '~/pages/admin/poster/baru.vue'
import { EASE, type VideoScene } from '~/video/timeline'
import { cam, rectIn, revealWords, typeInto } from '~/video/motion'
import { until } from '~/video/until'

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const rows = () => Array.from(root.value!.querySelectorAll('.vp-list tbody tr')) as HTMLElement[]

defineExpose<VideoScene & { ready: () => Promise<void> }>({
  ready: () => until(() => rows().length > 2 && !!root.value!.querySelector('.vp-form #title')),
  build(tl, at) {
    const layer = q('.vp-cam')
    tl.fromTo(layer, cam(1000, 420, 1.2), { ...cam(1000, 440, 1.22), duration: 3.4, ease: 'none' }, at)
    rows()
      .slice(0, 7)
      .forEach((r, i) => tl.fromTo(r, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.in }, at + 0.2 + i * 0.14))
    // cross-fade from the list to the upload form
    tl.fromTo(q('.vp-list'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: EASE.move }, at + 3.4)
    tl.fromTo(q('.vp-form'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.in }, at + 3.5)
    // spotlight: the poster file first, then the title while it is typed; the camera follows it
    const spot = q('.vp-spot')
    const r1 = rectIn(layer, q('.vp-form [aria-labelledby="s1"]'))
    const r2 = rectIn(layer, q('.vp-form [aria-labelledby="s2"]'))
    const mid = (r: typeof r1) => [r.left + r.width / 2 + 120, r.top + r.height / 2] as const
    tl.to(layer, { ...cam(...mid(r1), 1.2), duration: 1.2, ease: EASE.move }, at + 3.5)
    tl.fromTo(spot, { ...r1, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: EASE.in }, at + 4.4)
    tl.to(spot, { ...r2, duration: 0.7, ease: EASE.move }, at + 5.6)
    tl.to(layer, { ...cam(...mid(r2), 1.28), duration: 0.8, ease: EASE.move }, at + 5.6)
    typeInto(tl, q('.vp-form #title') as HTMLInputElement, 'Sleep Lab', at + 6.3, 10)
    tl.to(spot, { autoAlpha: 0, duration: 0.4 }, at + 7.6)
    tl.fromTo(q('.video-cap'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE.in }, at + 0.8)
    revealWords(tl, q('.video-line'), at + 0.9)
    tl.to(q('.video-cap'), { autoAlpha: 0, duration: 0.4 }, at + 3.3)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="vp-cam absolute inset-0 origin-top-left">
      <VideoWindow class="vp-list left-[240px] top-[90px]" title="Poster &amp; Pengumuman"><PosterList /></VideoWindow>
      <VideoWindow class="vp-form left-[240px] top-[90px]" :height="1800" title="Unggah poster"><PosterNew /></VideoWindow>
      <div class="vp-spot video-spot" />
    </div>
    <div class="video-cap right-[80px] bottom-[70px]">
      <div class="video-kicker">Kelola poster</div>
      <p class="video-line">Unggah sekali, tampil di semua kartu</p>
    </div>
    <div class="video-demo">Data contoh</div>
  </div>
</template>
