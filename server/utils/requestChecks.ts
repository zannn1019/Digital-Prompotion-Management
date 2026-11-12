import { UPLOAD } from '#shared/constants'

// Pure request checks used by server/middleware/security.ts (kept here so they can be unit tested).

/** JSON writes are small (the largest is a canvas design); uploads get the file limit plus multipart overhead. */
export const BODY_LIMIT = 1024 * 1024
export const UPLOAD_BODY_LIMIT = UPLOAD.maxBytes + 256 * 1024

/** Host of an Origin header, or null when it isn't a URL (e.g. "null" from sandboxed frames). */
export function originHost(origin: string): string | null {
  try {
    return new URL(origin).host
  } catch {
    return null
  }
}

/** Checks the declared size before any handler reads the body; returns an error status or null. */
export function bodySizeError(path: string, contentLength: string | undefined, transferEncoding: string | undefined): 411 | 413 | null {
  // Without a length the body can't be checked up front; browsers always send one.
  if (contentLength === undefined) return transferEncoding ? 411 : null
  const limit = path.split('?')[0] === '/api/uploads' ? UPLOAD_BODY_LIMIT : BODY_LIMIT
  const n = Number(contentLength)
  return !Number.isFinite(n) || n > limit ? 413 : null
}
