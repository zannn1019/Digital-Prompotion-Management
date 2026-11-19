// Shrinks uploaded images before they are stored: resized to fit IMAGE_COMPRESS.maxSide, turned
// upright from the photo's EXIF orientation, metadata (GPS, camera) dropped, saved as WebP (keeps
// transparency, so logos stay see-through). PDFs and anything that wouldn't get smaller are stored
// as they came. Plain Node code (no Nuxt imports), so the rules can be tested directly.
//
// Done on the server with sharp (libvips) so every client is covered, including old phones and
// files that skip the browser. It is tuned for a small server: one image at a time, one libvips
// thread, no cache, and a pixel cap so a huge PNG can't eat the memory.
import type { Sharp, SharpOptions } from 'sharp'

export const IMAGE_COMPRESS = {
  /** Longest side in pixels; bigger images are scaled down, smaller ones are never enlarged. */
  maxSide: 2400,
  /** WebP quality (0–100). */
  quality: 80,
  /** An image that needs no resizing is re-encoded only if this saves at least 10%. */
  minSaving: 0.1,
  /** Larger images are stored as they came rather than decoded (about 200 MB of memory at this size). */
  maxInputPixels: 50_000_000,
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export interface CompressedFile {
  data: Uint8Array
  type: string
  /** True when `data` is the re-encoded image, false when the original is kept. */
  compressed: boolean
  /** Why the original was kept (for the log). */
  reason?: string
  width?: number
  height?: number
}

type SharpFactory = (input: Uint8Array, options?: SharpOptions) => Sharp

let loaded: Promise<SharpFactory | null> | undefined
/** sharp is loaded on first use; if its native part is missing, uploads still work (uncompressed). */
function loadSharp(): Promise<SharpFactory | null> {
  loaded ??= import('sharp').then(
    m => {
      const sharp = m.default
      sharp.concurrency(1)
      sharp.cache(false)
      return sharp as SharpFactory
    },
    (e: unknown) => {
      console.warn('[upload] sharp is not available; images are stored uncompressed.', e)
      return null
    },
  )
  return loaded
}

// One image at a time: a burst of uploads queues up instead of stacking up memory.
let queue: Promise<unknown> = Promise.resolve()
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

const keep = (data: Uint8Array, type: string, reason: string): CompressedFile => ({
  data,
  type,
  compressed: false,
  reason,
})

export async function compressImage(data: Uint8Array, type: string): Promise<CompressedFile> {
  if (!IMAGE_TYPES.includes(type)) return keep(data, type, 'not an image')
  const sharp = await loadSharp()
  if (!sharp) return keep(data, type, 'sharp unavailable')
  return oneAtATime(async () => {
    try {
      const options: SharpOptions = { limitInputPixels: IMAGE_COMPRESS.maxInputPixels }
      const meta = await sharp(data, options).metadata()
      // Animated WebP/PNG would lose its animation.
      if ((meta.pages ?? 1) > 1) return keep(data, type, 'animated')
      const { maxSide, quality, minSaving } = IMAGE_COMPRESS
      // EXIF orientations 5–8 swap width and height.
      const turned = (meta.orientation ?? 1) >= 5
      const w = (turned ? meta.height : meta.width) ?? 0
      const h = (turned ? meta.width : meta.height) ?? 0
      const needsResize = Math.max(w, h) > maxSide
      const { data: out, info } = await sharp(data, options)
        .rotate()
        .resize({
          width: maxSide,
          height: maxSide,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer({ resolveWithObject: true })
      // Never store something bigger; skip near-equal re-encodes that only lose quality.
      const limit = needsResize ? data.length : data.length * (1 - minSaving)
      if (out.length >= limit) return keep(data, type, 'not smaller')
      return {
        data: new Uint8Array(out.buffer, out.byteOffset, out.length),
        type: 'image/webp',
        compressed: true,
        width: info.width,
        height: info.height,
      }
    } catch (e) {
      // Damaged or too large to decode: store it as it came, as before.
      return keep(data, type, `not decodable: ${(e as Error).message}`)
    }
  })
}

/** "poster.PNG" → "poster.webp" when the stored type changed. */
export function renameForType(name: string, type: string): string {
  if (type !== 'image/webp') return name
  return `${name.replace(/\.(png|jpe?g|webp)$/i, '')}.webp`
}
