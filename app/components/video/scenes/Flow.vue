<script setup lang="ts">
// Scene 5 · Alur kerja: the app's real flow as nodes joined by lines that draw in order,
// each carrying a dot so the direction reads at a glance.
import { BarChart3, LayoutGrid, MessageCircle, Nfc, Smartphone, Upload } from '@lucide/vue'
import { EASE, type VideoScene } from '~/video/timeline'
import { revealWords } from '~/video/motion'

const NODES = [
  { icon: Upload, title: 'Unggah poster', sub: 'Tim Marketing' },
  { icon: LayoutGrid, title: 'Halaman', sub: 'Poster + jadwal' },
  { icon: Nfc, title: 'Kartu NFC', sub: 'Dipasang di lokasi' },
  { icon: Smartphone, title: 'HP pengunjung', sub: 'Ketuk, poster tampil' },
  { icon: MessageCircle, title: 'WhatsApp', sub: 'Tanya langsung' },
  { icon: BarChart3, title: 'Analitik', sub: 'Tap & klik tercatat' },
]
const X = (i: number) => 230 + i * 292
const Y = 610
const links = NODES.slice(0, -1).map((_, i) => {
  const a = X(i) + 80
  const b = X(i + 1) - 80
  return {
    d: `M${a} ${Y} C${a + 60} ${Y - 44} ${b - 60} ${Y - 44} ${b} ${Y}`,
    head: `M${b - 14} ${Y - 10} L${b} ${Y} L${b - 14} ${Y + 10}`,
  }
})

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const qa = (s: string) => Array.from(root.value!.querySelectorAll(s)) as HTMLElement[]

defineExpose<VideoScene>({
  build(tl, at) {
    tl.fromTo(q('.vf-k'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, at)
    revealWords(tl, q('.vf-title'), at + 0.1, 0.1)
    tl.fromTo(q('.vf-cam'), { scale: 1 }, { scale: 1.04, duration: 8, ease: 'none' }, at)
    const T0 = at + 0.9
    const STEP = 0.95
    qa('.vf-node').forEach((n, i) => {
      tl.fromTo(n, { autoAlpha: 0, y: 30, scale: 0.85 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: EASE.pop }, T0 + i * STEP)
      tl.fromTo(
        n.querySelector('.vf-halo'),
        { scale: 1, autoAlpha: 0.8 },
        { scale: 1.3, autoAlpha: 0, duration: 0.8, ease: 'power2.out' },
        T0 + i * STEP + 0.05,
      )
    })
    const paths = qa('.vf-line') as unknown as SVGPathElement[]
    paths.forEach((p, i) => {
      const len = p.getTotalLength()
      const t = T0 + i * STEP + 0.35
      tl.fromTo(
        p,
        { strokeDasharray: len, strokeDashoffset: len, autoAlpha: 0 },
        { strokeDashoffset: 0, autoAlpha: 1, duration: 0.6, ease: EASE.move },
        t,
      )
      tl.fromTo(qa('.vf-head')[i]!, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, t + 0.5)
      // a dot keeps travelling along each finished link to show the direction
      const dot = qa('.vf-dot')[i]!
      const o = { p: 0 }
      const place = () => {
        const pt = p.getPointAtLength((o.p % 1) * len)
        dot.setAttribute('cx', pt.x.toFixed(1))
        dot.setAttribute('cy', pt.y.toFixed(1))
      }
      const end = at + 8
      tl.fromTo(dot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, t + 0.6)
      tl.fromTo(o, { p: 0 }, { p: (end - t - 0.6) * 0.7, duration: end - t - 0.6, ease: 'none', onUpdate: place }, t + 0.6)
    })
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="absolute inset-x-0 top-[150px] flex flex-col items-center text-center">
      <div class="vf-k video-kicker">Alur kerja</div>
      <h2 class="vf-title m-0 mt-3 text-[88px] leading-none font-black tracking-[-0.02em] text-[#1F2937]">Dari unggah sampai hasil</h2>
    </div>
    <div class="vf-cam absolute inset-0" style="transform-origin: 960px 600px">
      <svg class="absolute inset-0" width="1920" height="1080" viewBox="0 0 1920 1080" fill="none">
        <g v-for="(l, i) in links" :key="i" stroke="#1d6fa5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <path class="vf-line" :d="l.d" />
          <path class="vf-head" :d="l.head" />
        </g>
        <circle v-for="(l, i) in links" :key="'d' + i" class="vf-dot" r="9" fill="#00A2E9" />
      </svg>
      <div
        v-for="(n, i) in NODES"
        :key="n.title"
        class="vf-node absolute flex w-[230px] flex-col items-center gap-[18px] text-center"
        :style="{ left: X(i) - 115 + 'px', top: Y - 80 + 'px' }"
      >
        <div
          class="relative flex size-[160px] items-center justify-center rounded-full border border-[#dbe5ef] bg-white text-primary shadow-[0_20px_50px_rgb(15_23_42/10%)]"
        >
          <span class="vf-halo absolute -inset-2.5 rounded-full border-[3px] border-[#00A2E9]" />
          <component :is="n.icon" class="size-14" stroke-width="1.8" />
        </div>
        <div class="flex flex-col gap-1">
          <b class="text-[28px] font-black text-[#1F2937]">{{ n.title }}</b>
          <span class="text-[20px] text-[#5b6577]">{{ n.sub }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
