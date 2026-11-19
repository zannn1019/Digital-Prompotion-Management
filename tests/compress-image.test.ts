import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { IMAGE_COMPRESS, compressImage, renameForType } from '../server/utils/compressImage'

/** A noisy image (compresses like a photo, not like a flat colour). */
async function photo(width: number, height: number, alpha = false) {
  const channels = alpha ? 4 : 3
  const raw = Buffer.alloc(width * height * channels)
  let seed = 1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * channels
      for (let c = 0; c < 3; c++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        // A gradient with a little grain, like a photo.
        raw[p + c] = Math.min(255, ((x + y * (c + 1)) % 220) + (seed % 24))
      }
      // A see-through border, like a logo.
      if (alpha) raw[p + 3] = x < width / 5 || y < height / 5 ? 0 : 255
    }
  return sharp(raw, { raw: { width, height, channels } })
}

const meta = (data: Uint8Array) => sharp(data).metadata()

describe('compressImage', () => {
  it('scales a large JPEG down to the max side and stores WebP without metadata', async () => {
    const input = await (await photo(3200, 2000)).jpeg({ quality: 95 }).toBuffer()
    const out = await compressImage(input, 'image/jpeg')
    expect(out.compressed).toBe(true)
    expect(out.type).toBe('image/webp')
    expect(out.data.length).toBeLessThan(input.length)
    const m = await meta(out.data)
    expect(m.format).toBe('webp')
    expect(Math.max(m.width!, m.height!)).toBe(IMAGE_COMPRESS.maxSide)
    expect(m.width! / m.height!).toBeCloseTo(3200 / 2000, 2)
    expect(m.exif).toBeUndefined()
  })

  it('turns a photo upright from its EXIF orientation', async () => {
    // Stored 3000×1000 landscape, tagged "rotate 90°": shown as 1000×3000 portrait.
    const input = await (
      await photo(3000, 1000)
    )
      .jpeg({ quality: 95 })
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const out = await compressImage(input, 'image/jpeg')
    const m = await meta(out.data)
    expect(m.orientation).toBeUndefined()
    expect(m.width).toBe(800)
    expect(m.height).toBe(IMAGE_COMPRESS.maxSide)
  })

  it('never enlarges a small image', async () => {
    const input = await (await photo(600, 400)).png().toBuffer()
    const out = await compressImage(input, 'image/png')
    expect(out.compressed).toBe(true)
    const m = await meta(out.data)
    expect([m.width, m.height]).toEqual([600, 400])
  })

  it('keeps transparency (logos)', async () => {
    const input = await (await photo(500, 500, true)).png().toBuffer()
    const out = await compressImage(input, 'image/png')
    expect(out.type).toBe('image/webp')
    expect((await meta(out.data)).hasAlpha).toBe(true)
  })

  it('keeps the original when re-encoding would not make it smaller', async () => {
    // Already a small, low-quality WebP: quality 80 would only grow it.
    const input = await (await photo(400, 300)).webp({ quality: 30 }).toBuffer()
    const out = await compressImage(input, 'image/webp')
    expect(out).toMatchObject({ compressed: false, type: 'image/webp', reason: 'not smaller' })
    expect(out.data).toBe(input)
  })

  it('stores PDFs untouched', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF')
    const out = await compressImage(pdf, 'application/pdf')
    expect(out).toMatchObject({ compressed: false, type: 'application/pdf' })
    expect(out.data).toBe(pdf)
  })

  it('stores a damaged image as it came', async () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
    const out = await compressImage(broken, 'image/jpeg')
    expect(out).toMatchObject({ compressed: false, type: 'image/jpeg' })
    expect(out.data).toBe(broken)
  })

  it('keeps animated images (they would lose the animation)', async () => {
    const frames = await (await photo(200, 400)).raw().toBuffer()
    const input = await sharp(frames, {
      raw: { width: 200, height: 400, channels: 3, pageHeight: 200 },
    })
      .webp({ quality: 90, loop: 0, delay: [100, 100] })
      .toBuffer()
    expect((await meta(input)).pages).toBe(2)
    const out = await compressImage(input, 'image/webp')
    expect(out).toMatchObject({ compressed: false, reason: 'animated' })
  })

  it('handles several uploads at once, one at a time', async () => {
    const input = await (await photo(800, 600)).png().toBuffer()
    const outs = await Promise.all([1, 2, 3].map(() => compressImage(input, 'image/png')))
    expect(outs.every(o => o.compressed && o.type === 'image/webp')).toBe(true)
  })
})

describe('renameForType', () => {
  it('gives WebP files a .webp name', () => {
    expect(renameForType('Poster HUT.PNG', 'image/webp')).toBe('Poster HUT.webp')
    expect(renameForType('foto.jpeg', 'image/webp')).toBe('foto.webp')
    expect(renameForType('logo', 'image/webp')).toBe('logo.webp')
    expect(renameForType('brosur.pdf', 'application/pdf')).toBe('brosur.pdf')
  })
})
