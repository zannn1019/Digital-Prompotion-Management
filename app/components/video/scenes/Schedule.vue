<script setup lang="ts">
// Scene 4 · Jadwal tayang: step 2 of the real poster form. A pointer picks "1 bulan" and two pages,
// presses "Terbitkan poster"; a confirmation opens, then a success notice.
// The schedule's state comes from the timeline's time, so scrubbing backwards undoes it.
import type { Ref } from 'vue'
import { ArrowLeft, CalendarCheck, Check } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { Page } from '#shared/types'
import { EASE, sceneStart, type VideoScene } from '~/video/timeline'
import { cam, rectIn, revealWords } from '~/video/motion'
import { until } from '~/video/until'

const AT = sceneStart('schedule')
const T = { month: 1.05, page1: 1.85, page2: 2.35, publish: 3.05, yes: 4.35 }
const time = inject<Ref<number>>('videoTime')!
const local = computed(() => time.value - AT)

const { data: pages } = useFetch<(Page & { cardCount: number })[]>('/api/pages', { key: 'video-pages', server: false })
const shown = computed(() => (pages.value ?? []).filter(p => p.status !== 'draft').slice(0, 3))
const start = ref('2026-11-01')
const end = computed({ get: () => (local.value >= T.month ? '2026-11-30' : '2026-11-07'), set: () => {} })
const pageIds = computed({
  get: () =>
    [local.value >= T.page1 ? shown.value[0]?.id : null, local.value >= T.page2 ? shown.value[2]?.id : null].filter(Boolean) as string[],
  set: () => {},
})

const root = ref<HTMLElement>()
const q = (s: string) => root.value!.querySelector(s) as HTMLElement
const byText = (sel: string, text: string) =>
  Array.from(root.value!.querySelectorAll(sel)).find(e => e.textContent?.trim().startsWith(text)) as HTMLElement

defineExpose<VideoScene & { ready: () => Promise<void> }>({
  ready: () => until(() => (root.value?.querySelectorAll('[aria-labelledby="j2"] label').length ?? 0) >= 3),
  build(tl, at) {
    const layer = q('.vs-cam')
    tl.fromTo(layer, cam(900, 520, 1.15), { ...cam(860, 470, 1.3), duration: 1.4, ease: EASE.move }, at + 0.2)
    tl.to(layer, { ...cam(900, 700, 1.25), duration: 1.0, ease: EASE.move }, at + 1.6)
    tl.to(layer, { ...cam(960, 560, 1.15), duration: 1.0, ease: EASE.move }, at + 3.4)
    tl.to(layer, { ...cam(1100, 640, 1.22), duration: 2.0, ease: EASE.move }, at + 4.8)

    // pointer travels between the real controls, measured from the window
    const ptr = q('.vs-ptr')
    const centre = (el: Element) => {
      const r = rectIn(layer, el, 0)
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    const targets = [
      [T.month, byText('[aria-labelledby="j1"] button', '1 bulan')],
      [T.page1, root.value!.querySelectorAll('[aria-labelledby="j2"] label input')[0]],
      [T.page2, root.value!.querySelectorAll('[aria-labelledby="j2"] label input')[2]],
      [T.publish, q('.vs-publish')],
      [T.yes, q('.vs-yes')],
    ] as const
    tl.fromTo(ptr, { x: 1500, y: 860, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, at + 0.1)
    for (const [t, el] of targets) {
      tl.to(ptr, { ...centre(el!), duration: 0.7, ease: EASE.move }, at + t - 0.75)
      tl.to(ptr, { scale: 0.85, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut' }, at + t - 0.05)
      tl.fromTo(
        q('.vs-ring'),
        { ...centre(el!), scale: 0.3, autoAlpha: 0.9 },
        { scale: 1.6, autoAlpha: 0, duration: 0.45, ease: 'power2.out' },
        at + t,
      )
    }
    tl.to(ptr, { autoAlpha: 0, duration: 0.3 }, at + 4.6)

    // confirmation, then the success notice
    tl.fromTo(q('.vs-dim'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, at + 3.15)
    tl.fromTo(q('.vs-modal'), { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: EASE.pop }, at + 3.2)
    tl.to([q('.vs-modal'), q('.vs-dim')], { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, at + 4.45)
    tl.fromTo(
      q('.vs-toast'),
      { autoAlpha: 0, y: 30, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: EASE.pop },
      at + 4.8,
    )

    tl.fromTo(q('.video-cap'), { autoAlpha: 0, y: -16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.in }, at + 5.0)
    revealWords(tl, q('.video-line'), at + 5.1, 0.07)
  },
})
</script>

<template>
  <div ref="root" class="video-bg">
    <div class="vs-cam absolute inset-0 origin-top-left">
      <VideoWindow class="left-[240px] top-[90px]" title="Buat poster">
        <AdminPageHeader title="Buat poster" description="Unggah poster yang sudah jadi, lalu atur jadwal dan halaman." />
        <div class="flex max-w-[760px] flex-col gap-6 text-base">
          <ol aria-label="Langkah" class="flex flex-wrap gap-2 text-base">
            <li class="flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 font-semibold text-green-900">
              <Check class="size-4" aria-hidden="true" />Gambar &amp; isi poster
            </li>
            <li class="flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">
              <span>2</span>Atur jadwal &amp; halaman
            </li>
          </ol>
          <AdminScheduleStep v-model:start="start" v-model:end="end" v-model:page-ids="pageIds" :pages="shown" :errors="{}" />
          <div class="flex flex-wrap items-center gap-3 rounded-2xl border bg-background p-4 shadow-lg">
            <Button type="button" variant="ghost" class="h-13 px-3 text-base"><ArrowLeft class="size-4" />Kembali ke isi poster</Button>
            <span class="grow" />
            <Button type="button" variant="outline" class="h-13 px-5 text-base">Simpan Draft</Button>
            <Button type="button" class="vs-publish h-13 px-5 text-base">Terbitkan poster</Button>
          </div>
        </div>
      </VideoWindow>
      <div class="vs-dim absolute left-[240px] top-[90px] h-[900px] w-[1440px] rounded-[18px] bg-black/40" />
      <div class="vs-modal absolute left-[700px] top-[380px] flex w-[520px] flex-col gap-3 rounded-xl border bg-background p-6 shadow-2xl">
        <span class="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary"><CalendarCheck class="size-6" /></span>
        <b class="text-xl">Terbitkan poster Sleep Lab?</b>
        <p class="m-0 text-[15px] leading-relaxed text-muted-foreground">
          Poster tampil 1–30 Nov 2026 di 2 halaman, lalu berhenti sendiri.
        </p>
        <div class="mt-2 flex justify-end gap-2">
          <Button variant="outline" class="h-11">Batal</Button>
          <Button class="vs-yes h-11">Ya, terbitkan</Button>
        </div>
      </div>
      <div
        class="vs-toast absolute left-[1220px] top-[880px] flex items-center gap-3 rounded-xl border bg-background px-5 py-4 text-[16px] shadow-xl"
      >
        <span class="flex size-8 items-center justify-center rounded-full bg-green-700 text-white"><Check class="size-5" /></span>
        <span><b>Poster terjadwal.</b> Tampil mulai 1 Nov 2026.</span>
      </div>
      <span class="vs-ring absolute left-0 top-0 -ml-6 -mt-6 size-12 rounded-full border-[3px] border-[#00A2E9]" />
      <svg class="vs-ptr absolute left-0 top-0" width="34" height="40" viewBox="0 0 34 40" aria-hidden="true">
        <path d="M3 3 L3 33 L11 25 L17 38 L23 35 L17 23 L28 23 Z" fill="#1f2937" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="video-cap right-[80px] top-[80px] max-w-[640px]">
      <div class="video-kicker">Jadwal tayang</div>
      <p class="video-line">Tampil dan berhenti sendiri sesuai tanggal</p>
    </div>
  </div>
</template>
