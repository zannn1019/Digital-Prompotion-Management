import { UPLOAD } from '#shared/constants'
import { fmtBytes } from '#shared/utils/format'

export interface UploadedFile {
  url: string
  name: string
  size: number
  /** Image to show for the file (a placeholder for PDFs). */
  previewUrl?: string
  type?: string
}

const TYPE_NAME: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/webp': 'WebP', 'application/pdf': 'PDF' }

/** Client-side check before uploading; returns a message, or '' when the file is fine. The server checks again. */
export function checkUpload(f: File, types: readonly string[] = UPLOAD.types): string {
  if (!types.includes(f.type))
    return `Format tidak didukung: “${f.name}”. Simpan atau unduh sebagai ${types.map(t => TYPE_NAME[t]).join(', ')}.`
  if (f.size > UPLOAD.maxBytes)
    return `File terlalu besar (${fmtBytes(f.size)}). Batas maksimal 5 MB — simpan ulang dengan ukuran lebih kecil (misal 1080 × 1350), lalu unggah lagi.`
  return ''
}

/** Uploads a file or blob; throws with a user-facing message on failure. */
export async function uploadFile(file: Blob, name: string): Promise<UploadedFile> {
  const body = new FormData()
  body.append('file', file, name)
  try {
    return await $fetch<UploadedFile>('/api/uploads', { method: 'POST', body })
  } catch (e: any) {
    throw new Error(e?.data?.statusMessage ?? 'Gagal mengunggah. Coba lagi.', { cause: e })
  }
}
