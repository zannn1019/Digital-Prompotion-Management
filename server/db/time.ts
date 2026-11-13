// Turns database timestamps into the strings the API has always returned. Plain TypeScript.

const JAKARTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** `2026-11-13 09:05` in Jakarta time (WIB), or null. */
export function toStamp(d: Date | null | undefined): string | null {
  if (!d) return null
  const p = Object.fromEntries(JAKARTA.formatToParts(d).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

/** ISO string (UTC), or null. */
export const toIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null)
