<script setup lang="ts">
// Product demo video studio (dev only). A 1920×1080 stage plays the eight scenes from one paused
// GSAP timeline, so the preview and the MP4 export (scripts/render-video.mjs) show identical frames.
// ?capture=1 hides the controls and exposes window.__video for the export script.
import { gsap } from 'gsap'
import { DURATION, FPS, SCENES, STAGE, sceneStart, type VideoScene } from '~/video/timeline'

definePageMeta({ layout: false, middleware: 'video-studio' })
useHead({ title: 'Demo produk · Poster Digital NFC' })

const route = useRoute()
const capture = route.query.capture === '1'
const ready = ref(false)
const authed = ref(false)
const playing = ref(false)
const time = ref(0)
const scale = ref(1)
// Scenes that change real component state derive it from the timeline's time, so seeking works both ways.
provide('videoTime', time)
const scenes = ref<Record<string, VideoScene & { $el?: HTMLElement; ready?: () => Promise<void> }>>({})
let tl: gsap.core.Timeline | null = null

function setRef(id: string) {
  return (el: unknown) => {
    if (el) scenes.value[id] = el as VideoScene
  }
}

function fit() {
  scale.value = capture ? 1 : Math.min((window.innerWidth - 32) / STAGE.width, (window.innerHeight - 120) / STAGE.height)
}

onMounted(async () => {
  fit()
  window.addEventListener('resize', fit)
  // Sign in as the seeded Super Admin so the real admin screens load their demo data.
  await $fetch('/api/_video/session', { method: 'POST' })
  await useSession().refresh()
  // Mount the real screens only now, so their data requests carry the session.
  authed.value = true
  await nextTick()
  await Promise.all(SCENES.map(s => scenes.value[s.id]?.ready?.() ?? Promise.resolve()))
  await document.fonts.ready
  // Load every picture now; lazy images in hidden scenes would otherwise miss the export.
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#video-stage img'))
  imgs.forEach(i => (i.loading = 'eager'))
  await Promise.all(imgs.map(i => i.decode().catch(() => {})))

  tl = gsap.timeline({
    paused: true,
    onUpdate: () => {
      time.value = tl!.time()
    },
  })
  for (const s of SCENES) {
    const el = document.getElementById(`scene-${s.id}`)!
    const at = sceneStart(s.id)
    // Scenes cut hard from one to the next.
    tl.set(el, { autoAlpha: 1 }, at).set(el, { autoAlpha: 0 }, at + s.duration)
    scenes.value[s.id]!.build(tl, at)
  }
  tl.set({}, {}, DURATION)
  tl.seek(0)
  ready.value = true
  ;(window as unknown as { __video: unknown }).__video = {
    fps: FPS,
    duration: DURATION,
    seek: (t: number) => tl!.seek(t, false),
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  tl?.kill()
})

function toggle() {
  if (!tl) return
  if (tl.time() >= DURATION) tl.seek(0)
  playing.value = !playing.value
  if (playing.value) tl.play()
  else tl.pause()
}
function scrub(e: Event) {
  const t = Number((e.target as HTMLInputElement).value)
  tl?.pause().seek(t)
  playing.value = false
}
const sceneNow = computed(() => {
  let t = 0
  for (const s of SCENES) {
    if (time.value < t + s.duration) return s.title
    t += s.duration
  }
  return SCENES.at(-1)!.title
})
</script>

<template>
  <div :class="capture ? 'video-capture' : 'flex min-h-screen flex-col items-center gap-4 bg-zinc-900 p-4 text-zinc-100'">
    <div :style="capture ? undefined : { width: STAGE.width * scale + 'px', height: STAGE.height * scale + 'px' }">
      <div
        id="video-stage"
        class="video-stage relative overflow-hidden"
        :style="{ width: STAGE.width + 'px', height: STAGE.height + 'px', transform: `scale(${scale})`, transformOrigin: '0 0' }"
      >
        <template v-if="authed">
          <VideoScenesIntro id="scene-intro" :ref="setRef('intro')" />
          <VideoScenesDash id="scene-dash" :ref="setRef('dash')" />
          <VideoScenesPosters id="scene-posters" :ref="setRef('posters')" />
          <VideoScenesSchedule id="scene-schedule" :ref="setRef('schedule')" />
          <VideoScenesFlow id="scene-flow" :ref="setRef('flow')" />
          <VideoScenesAnalytics id="scene-analytics" :ref="setRef('analytics')" />
          <VideoScenesFeatures id="scene-features" :ref="setRef('features')" />
          <VideoScenesClosing id="scene-closing" :ref="setRef('closing')" />
        </template>
      </div>
    </div>

    <div v-if="!capture" class="flex w-full max-w-5xl items-center gap-3 text-sm">
      <button type="button" class="h-10 rounded-md bg-white px-4 font-bold text-zinc-900" :disabled="!ready" @click="toggle">
        {{ playing ? 'Jeda' : 'Putar' }}
      </button>
      <input
        aria-label="Posisi video"
        type="range"
        class="grow"
        min="0"
        :max="DURATION"
        step="0.0333"
        :value="time"
        :disabled="!ready"
        @input="scrub"
      />
      <span class="w-40 tabular-nums">{{ time.toFixed(1) }} / {{ DURATION }} s · {{ sceneNow }}</span>
    </div>
  </div>
</template>

<style>
.video-capture {
  width: 1920px;
  height: 1080px;
  overflow: hidden;
}
.video-stage {
  background: #f7fafc;
  font-family: Lato, system-ui, sans-serif;
}
.video-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(70% 60% at 50% 20%, #ffffff, #f7fafc 70%), linear-gradient(180deg, #ffffff, #e9f3fa);
}
/* Captions that sit on top of app screens. */
.video-cap {
  position: absolute;
  padding: 26px 34px;
  border-radius: 24px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 20px 50px rgb(15 23 42 / 10%);
}
.video-kicker {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1d6fa5;
}
.video-line {
  margin: 8px 0 0;
  font-size: 56px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: #1f2937;
}
.video-demo {
  position: absolute;
  right: 40px;
  bottom: 28px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgb(255 255 255 / 92%);
  border: 1px solid #dbe5ef;
  font-size: 16px;
  color: #5b6577;
}
/* Spotlight: a rounded hole in a soft dim, with an accent ring. */
.video-spot {
  position: absolute;
  border-radius: 22px;
  pointer-events: none;
  box-shadow: 0 0 0 4000px rgb(15 23 42 / 38%);
  outline: 3px solid #00a2e9;
  outline-offset: 4px;
}
.video-stage > [id^='scene-'] {
  position: absolute;
  inset: 0;
  visibility: hidden;
}
</style>
