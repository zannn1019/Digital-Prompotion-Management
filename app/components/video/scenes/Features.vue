<script setup lang="ts">
// Scene 7 · Fitur lainnya: real screens float as small windows (and the visitor page on a phone);
// a spotlight visits each in turn while its name is shown.
import type { PublicView } from '#shared/types'
import Pengumuman from '~/pages/admin/pengumuman/baru.vue'
import Kartu from '~/pages/admin/kartu/index.vue'
import Pengguna from '~/pages/admin/pengguna.vue'
import Audit from '~/pages/admin/audit.vue'
import Pengaturan from '~/pages/admin/pengaturan.vue'
import { EASE, type VideoScene } from '~/video/timeline'
import { until } from '~/video/until'

const S = 0.33
const CW = Math.round(1440 * S)
const CH = Math.round(900 * S)
const CELLS = [
  { label: 'Pengumuman penting', page: Pengumuman, title: 'Buat pengumuman' },
  { label: 'Kartu NFC & QR cadangan', page: Kartu, title: 'Kartu NFC' },
  { label: 'Halaman pengunjung', page: null, title: '' },
  { label: 'Pengguna & hak akses', page: Pengguna, title: 'Pengguna' },
  { label: 'Audit log', page: Audit, title: 'Audit Log' },
  { label: 'Pengaturan situs', page: Pengaturan, title: 'Pengaturan' },
]
const pos = (i: number) => ({ left: 190 + (i % 3) * 560, top: 300 + Math.floor(i / 3) * 375 })

const { data: view } = useFetch<PublicView>('/api/public/k/K7Q2M9XA', { key: 'video-public', server: false })

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const qa = (s: string) => Array.from(root.value!.querySelectorAll(s)) as HTMLElement[]

defineExpose<VideoScene & { ready: () => Promise<void> }>({
  ready: () => until(() => !!view.value && qa('.vfe-cell table tbody tr').length > 2),
  build(tl, at) {
    // the heading is already in place at the cut, so the scene never opens on an empty frame
    tl.fromTo(q('.vfe-cam'), { scale: 1 }, { scale: 1.03, duration: 10, ease: 'none' }, at)
    qa('.vfe-cell').forEach((c, i) => {
      tl.fromTo(c, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE.in }, at + 0.05 + i * 0.15)
      tl.fromTo(
        c,
        { y: 0 },
        { y: 8, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: 3, immediateRender: false },
        at + 0.9 + i * 0.15,
      )
    })
    // spotlight visits each screen; its label lights up with it
    const spot = q('.vfe-spot')
    const box = (i: number) => ({ left: pos(i).left - 16, top: pos(i).top - 16, width: CW + 32, height: CH + 32 + 52 })
    const t0 = at + 2.2
    const dwell = 1.2
    tl.fromTo(spot, { ...box(0), autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: EASE.in }, t0 - 0.2)
    qa('.vfe-label').forEach((l, i) => {
      if (i > 0) tl.to(spot, { ...box(i), duration: 0.45, ease: EASE.move }, t0 + i * dwell - 0.3)
      tl.fromTo(l, { color: '#5b6577' }, { color: '#2F318B', duration: 0.3 }, t0 + i * dwell - 0.1)
    })
    tl.to(spot, { autoAlpha: 0, duration: 0.5 }, at + 9.4)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="vfe-cam absolute inset-0" style="transform-origin: 960px 640px">
      <div v-for="(c, i) in CELLS" :key="c.label" class="vfe-cell absolute" :style="{ left: pos(i).left + 'px', top: pos(i).top + 'px' }">
        <div class="relative" :style="{ width: CW + 'px', height: CH + 'px' }">
          <div v-if="c.page" class="absolute left-0 top-0 origin-top-left" :style="{ transform: `scale(${S})` }">
            <VideoWindow class="left-0 top-0" :title="c.title"><component :is="c.page" /></VideoWindow>
          </div>
          <div v-else class="absolute left-[160px] top-[-10px] origin-top-left" :style="{ transform: 'scale(0.42)' }">
            <AdminPhoneFrame><PosterView v-if="view" :view="view" preview class="min-h-full" /></AdminPhoneFrame>
          </div>
        </div>
        <div class="vfe-label mt-3 text-center text-[26px] font-black text-[#5b6577]">{{ c.label }}</div>
      </div>
      <div class="vfe-spot video-spot" />
    </div>
    <div class="absolute left-[150px] top-[110px]">
      <div class="vfe-k video-kicker">Fitur lainnya</div>
      <h2 class="vfe-title m-0 mt-3 text-[80px] leading-none font-black tracking-[-0.02em] text-[#1F2937]">
        Semua yang dibutuhkan tim Marketing
      </h2>
    </div>
  </div>
</template>
