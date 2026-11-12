// Product demo video: one place for the scene order and lengths (seconds).
// Change a duration here and every later scene shifts with it.
import type { gsap } from 'gsap'

export const FPS = 30
export const STAGE = { width: 1920, height: 1080 } as const

export const SCENES = [
  { id: 'intro', title: 'Pembuka', duration: 5 },
  { id: 'dash', title: 'Beranda', duration: 5 },
  { id: 'posters', title: 'Kelola poster', duration: 8 },
  { id: 'schedule', title: 'Jadwal tayang', duration: 7 },
  { id: 'flow', title: 'Alur kerja', duration: 8 },
  { id: 'analytics', title: 'Analitik', duration: 7 },
  { id: 'features', title: 'Fitur lainnya', duration: 10 },
  { id: 'closing', title: 'Penutup', duration: 8 },
] as const

export type SceneId = (typeof SCENES)[number]['id']
export const DURATION = SCENES.reduce((s, x) => s + x.duration, 0)
export function sceneStart(id: SceneId) {
  let t = 0
  for (const s of SCENES) {
    if (s.id === id) return t
    t += s.duration
  }
  return t
}

/** Each scene adds its tweens to the master timeline, starting at `at` (seconds). */
export interface VideoScene {
  build(tl: gsap.core.Timeline, at: number): void
}

// Shared easing: calm arrivals, smooth repositioning.
export const EASE = { in: 'power3.out', move: 'power2.inOut', pop: 'back.out(1.6)' } as const
