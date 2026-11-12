<script setup lang="ts">
// Scene 1 · Pembuka: the logo, the product name and its line, revealed word by word.
import { EASE, type VideoScene } from '~/video/timeline'
import { revealWords } from '~/video/motion'

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement

defineExpose<VideoScene>({
  build(tl, at) {
    tl.fromTo(q('.vi-logo'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE.in }, at + 0.1)
    revealWords(tl, q('.vi-title'), at + 0.35, 0.14)
    tl.fromTo(q('.vi-rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: EASE.move }, at + 1.1)
    revealWords(tl, q('.vi-sub'), at + 1.4, 0.06)
    // a slow push over the whole scene
    tl.fromTo(q('.vi-wrap'), { scale: 1 }, { scale: 1.025, duration: 5, ease: 'none' }, at)
    tl.fromTo(q('.vi-orb'), { y: 0 }, { y: 18, duration: 5, ease: 'sine.inOut' }, at)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div
      class="vi-orb absolute left-[1100px] top-[-60px] size-[720px] rounded-full bg-[radial-gradient(closest-side,rgb(0_162_233/10%),transparent)]"
    />
    <div class="vi-wrap absolute inset-x-0 top-[290px] flex flex-col items-center gap-8 text-center">
      <img class="vi-logo h-16 w-auto" src="/brand/logo.png" alt="RS Bethesda Yogyakarta" />
      <h1 class="vi-title m-0 text-[132px] leading-none font-black tracking-[-0.025em] text-[#1F2937]">Poster Digital NFC</h1>
      <span class="vi-rule block h-[5px] w-[360px] origin-center rounded-full bg-[#00A2E9]" />
      <p class="vi-sub m-0 text-[36px] text-[#5b6577]">Promosi rumah sakit, cukup satu ketukan.</p>
    </div>
  </div>
</template>
