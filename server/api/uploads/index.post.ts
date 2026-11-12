import { randomBytes } from 'node:crypto'
import { UPLOAD } from '#shared/constants'

// Dummy upload: keeps the file in memory and serves it back from /api/uploads/:id.
// The real backend stores it, converts PDFs to an image and resizes to WebP.
// The request size is already capped by server/middleware/security.ts before the body is read.
const MAX_BYTES = UPLOAD.maxBytes

/** Detects the type from the file's first bytes; the browser-sent type is not trusted. */
function sniff(b: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
  if (ascii(0, 5) === '%PDF-') return 'application/pdf'
  return null
}

export default defineEventHandler(async event => {
  requireUser(event)
  rateLimit(event, 'upload', 30, 60_000)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  if (!file?.data?.length) throw createError({ statusCode: 422, statusMessage: 'Pilih file terlebih dahulu.' })
  if (file.data.length > MAX_BYTES)
    throw createError({ statusCode: 422, statusMessage: 'Ukuran file melebihi 5 MB. Perkecil ukuran gambar lalu unggah ulang.' })
  const type = sniff(file.data)
  if (!type) throw createError({ statusCode: 422, statusMessage: 'Format file tidak didukung. Gunakan PNG, JPG, WebP, atau PDF.' })

  // 128 random bits: upload addresses can't be guessed or counted through.
  const id = `f${randomBytes(16).toString('hex')}`
  uploads.set(id, { type, data: file.data })
  const url = `/api/uploads/${id}`
  // A PDF poster needs an image for the page; converting its first page is not built yet.
  const previewUrl = type === 'application/pdf' ? '/dummy/pdf-placeholder.svg' : url
  // Keep only a safe display name: no paths, no control characters.
  const name =
    (file.filename ?? 'poster')
      .replace(/^.*[\\/]/, '')
      .replace(/[^\p{L}\p{N} ._()-]/gu, '')
      .slice(0, 120) || 'poster'
  return { url, previewUrl, type, name, size: file.data.length }
})
