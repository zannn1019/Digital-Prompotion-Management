// Rules for counting taps and clicks fairly (pure logic, no auto-imports, so tests can use it).
// A tap or click is counted at most once per client, card and target within a short window;
// browser prefetches are ignored and link-preview bots go to the `bots` column instead.

/** Same client, card and target within this window count once. */
export const DEDUPE_MS = 30_000
/** Above this many remembered visits, expired ones are dropped so the map can't grow without end. */
const PRUNE_AT = 10_000

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegrambot|slackbot/i

export type Visit = 'count' | 'repeat' | 'prefetch' | 'bot'

/** A browser prefetch (`Sec-Purpose: prefetch` or the older `Purpose: prefetch`): nobody opened the page yet. */
export function isPrefetch(secPurpose: string | undefined, purpose: string | undefined): boolean {
  return /prefetch/i.test(secPurpose ?? '') || /prefetch/i.test(purpose ?? '')
}

/** Link-preview fetchers and crawlers, e.g. when a poster link is pasted into WhatsApp. */
export function isBot(userAgent: string | undefined): boolean {
  return BOT_UA.test(userAgent ?? '')
}

export function createVisitCounter(windowMs = DEDUPE_MS) {
  const seen = new Map<string, number>()

  /** Decides what to do with one request. `key` identifies the card and target (poster/button). */
  function classify(ip: string, key: string, headers: { secPurpose?: string; purpose?: string; userAgent?: string }, now: number): Visit {
    if (isPrefetch(headers.secPurpose, headers.purpose)) return 'prefetch'
    if (isBot(headers.userAgent)) return 'bot'
    if (seen.size > PRUNE_AT) for (const [k, until] of seen) if (until <= now) seen.delete(k)
    const id = `${ip}|${key}`
    const until = seen.get(id)
    if (until !== undefined && until > now) return 'repeat'
    seen.set(id, now + windowMs)
    return 'count'
  }

  return { classify, size: () => seen.size }
}
