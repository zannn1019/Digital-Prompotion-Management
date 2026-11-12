// Small animation helpers shared by the video scenes. Everything is a tween on the paused
// master timeline, so any frame can be reproduced exactly by seeking.
import { gsap } from 'gsap'
import { EASE, STAGE } from './timeline'

/** Splits an element's text into word spans (once) and returns them. */
export function words(el: HTMLElement) {
  if (!el.dataset.split) {
    const parts = (el.textContent ?? '').trim().split(/\s+/)
    el.innerHTML = parts.map(w => `<span style="display:inline-block;white-space:pre">${w} </span>`).join('')
    el.dataset.split = '1'
  }
  return Array.from(el.children) as HTMLElement[]
}

/** Words rise in one after another. */
export function revealWords(tl: gsap.core.Timeline, el: HTMLElement, at: number, stagger = 0.08) {
  tl.fromTo(words(el), { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EASE.in, stagger }, at)
}

/** Counts a number up from half its value; keeps the app's own formatting (id-ID). */
export function countUp(tl: gsap.core.Timeline, el: HTMLElement, at: number, duration = 1.6) {
  const raw = el.textContent ?? ''
  const m = raw.match(/[\d.]+/)
  if (!m) return
  const target = Number(m[0].replace(/\./g, ''))
  const fmt = (n: number) => raw.replace(m[0], Math.round(n).toLocaleString('id-ID'))
  const o = { v: target * 0.5 }
  const onUpdate = () => {
    el.textContent = fmt(o.v)
  }
  tl.fromTo(o, { v: target * 0.5 }, { v: target, duration, ease: 'power2.out', onUpdate }, at)
}

/** Types text into an input or textarea, character by character. */
export function typeInto(tl: gsap.core.Timeline, el: HTMLInputElement | HTMLTextAreaElement, text: string, at: number, cps = 12) {
  const o = { n: 0 }
  const onUpdate = () => {
    el.value = text.slice(0, Math.round(o.n))
  }
  tl.fromTo(o, { n: 0 }, { n: text.length, duration: text.length / cps, ease: 'none', onUpdate }, at)
}

/** Camera: brings layer point (cx, cy) to the stage centre at zoom z. The layer's origin must be 0 0. */
export function cam(cx: number, cy: number, z: number) {
  return { x: STAGE.width / 2 - cx * z, y: STAGE.height / 2 - cy * z, scale: z }
}

/** Rect of `el` in `layer` coordinates (measured while the layer is untransformed). */
export function rectIn(layer: HTMLElement, el: Element, pad = 16) {
  const a = layer.getBoundingClientRect()
  const b = el.getBoundingClientRect()
  const s = a.width / layer.offsetWidth || 1
  return { left: (b.left - a.left) / s - pad, top: (b.top - a.top) / s - pad, width: b.width / s + pad * 2, height: b.height / s + pad * 2 }
}

export { gsap }
