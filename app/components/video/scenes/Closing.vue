<script setup lang="ts">
// Scene 8 · Penutup: clean ground, the logo wipes in, then the name and tagline, then a soft fade.
import { EASE, type VideoScene } from '~/video/timeline'
import { revealWords } from '~/video/motion'

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement

defineExpose<VideoScene>({
  build(tl, at) {
    tl.fromTo(q('.vc-veil'), { autoAlpha: 0.9 }, { autoAlpha: 0, duration: 0.6, ease: EASE.in }, at)
    tl.fromTo(
      q('.vc-logo'),
      { clipPath: 'inset(0 100% 0 0)', scale: 0.96 },
      { clipPath: 'inset(0 0% 0 0)', scale: 1, duration: 1.3, ease: EASE.move },
      at + 0.3,
    )
    tl.fromTo(q('.vc-ring'), { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.2, ease: EASE.in }, at)
    revealWords(tl, q('.vc-name'), at + 1.4, 0.12)
    revealWords(tl, q('.vc-tag'), at + 2.4, 0.06)
    tl.fromTo(q('.vc-note'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, at + 3.4)
    tl.fromTo(q('.vc-wrap'), { scale: 1 }, { scale: 1.02, duration: 8, ease: 'none' }, at)
    tl.to(q('.vc-veil'), { autoAlpha: 0.45, duration: 1, ease: 'power1.in' }, at + 7)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="vc-ring absolute left-[540px] top-[20px] size-[840px] rounded-full border-2 border-[rgb(0_162_233/22%)]" />
    <div class="vc-wrap absolute inset-x-0 top-[300px] flex flex-col items-center gap-7 text-center">
      <img class="vc-logo h-[120px] w-auto" src="/brand/logo.png" alt="RS Bethesda Yogyakarta" />
      <h2 class="vc-name m-0 text-[104px] leading-none font-black tracking-[-0.025em] text-[#1F2937]">Poster Digital NFC</h2>
      <p class="vc-tag m-0 text-[38px] text-[#5b6577]">Promosi rumah sakit, cukup satu ketukan.</p>
    </div>
    <div class="vc-note absolute inset-x-0 bottom-[60px] text-center text-[20px] text-[#5b6577]">Konsep desain · November 2026</div>
    <div class="vc-veil absolute inset-0 bg-white" />
  </div>
</template>
