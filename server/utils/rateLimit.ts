import type { H3Event } from 'h3'

// Fixed-window, in-memory rate limiter. Good enough for one server process;
// use Redis or the proxy (Nginx limit_req) when running several.
const windows = new Map<string, { count: number; resetAt: number }>()
/** Above this many tracked clients, expired windows are dropped so the map can't grow without end. */
const PRUNE_AT = 10_000

export function rateLimit(event: H3Event, scope: string, limit: number, windowMs: number) {
  const key = `${scope}:${clientIp(event)}`
  const now = Date.now()
  if (windows.size > PRUNE_AT) for (const [k, w] of windows) if (w.resetAt < now) windows.delete(k)
  const w = windows.get(key)
  if (!w || w.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  w.count += 1
  if (w.count > limit) {
    setHeader(event, 'Retry-After', Math.ceil((w.resetAt - now) / 1000))
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' })
  }
}
