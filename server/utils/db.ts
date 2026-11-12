// In-memory dummy database. Resets whenever the dev server restarts.
// Replace these collections with real persistence when the backend is ready;
// the API routes are the only code that touches them.
import type { AuditEntry, Card, DailyRow, Page, Poster, Settings, User } from '#shared/types'
import { TODAY, addDays, nowStamp } from '#shared/utils/format'
import { DEMO_PASSWORD, createCredentialStore, seedPassword } from './passwords'

const users: User[] = [
  { id: 'u1', name: 'Admin', email: 'admin@gmail.com', role: 'super', status: 'active', lastLogin: '2026-10-27 08:12' },
]

const posters: Poster[] = []

const pages: Page[] = []

const cards: Card[] = [].map(
  ([code, label, group, pageId, status, writeStatus, writtenAt, locked, lastTap]) =>
    ({
      code,
      label,
      group,
      pageId,
      status,
      writeStatus,
      writtenAt,
      writtenBy: writtenAt ? 'u4' : null,
      locked,
      lastTap,
    }) as Card,
)

const audit: AuditEntry[] = []

const settings: Settings = {
  company: 'RS Bethesda Yogyakarta',
  tagline: 'Tolong Dulu Urusan Belakang',
  logoUrl: '/brand/logo.png',
  address: 'Jl. Jend. Sudirman No. 70, Yogyakarta 55224',
  // Placeholders: replace with the Marketing team's real WhatsApp and phone numbers.
  wa: '628000000001',
  phone: '(0274) 586688',
  email: 'marketing@rs-bethesda.test',
  hours: 'Senin–Jumat, 08.00–16.00 WIB',
  website: 'https://www.bethesda.or.id',
  brochure: 'https://www.bethesda.or.id',
  retentionAudit: 365,
  retentionTap: 730,
  baseUrl: 'https://poster.rs-bethesda.test/k/',
}

// Deterministic fake analytics for the last 90 days (no personal data).
function buildDaily(): DailyRow[] {
  let seed = 20261027
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const rows: DailyRow[] = []
  const clickable = ['p1|wa', 'p1|tel', 'p1|doc', 'p2|wa', 'p2|tel', 'p3|wa', 'p4|wa', 'p5|doc']
  for (let d = 89; d >= 0; d--) {
    const date = addDays(TODAY, -d)
    const dow = new Date(`${date}T00:00:00`).getDay()
    const weekday = dow === 0 ? 0.35 : dow === 6 ? 0.6 : 1
    const trend = 0.7 + ((89 - d) / 89) * 0.6
    cards.forEach((c, ci) => {
      if (!c.lastTap || !c.pageId) return
      if (c.status === 'nonaktif' && d < 28) return
      const base = (ci % 3 === 0 ? 9 : 5) * weekday * trend
      const taps = Math.max(0, Math.round(base + (rnd() - 0.5) * base))
      if (!taps) return
      const clicks: Record<string, number> = {}
      const n = Math.round(taps * (0.18 + rnd() * 0.15))
      for (let k = 0; k < n; k++) {
        const key = clickable[Math.floor(rnd() * clickable.length)]!
        clicks[key] = (clicks[key] || 0) + 1
      }
      rows.push({ date, card: c.code, pageId: c.pageId, taps, bots: rnd() < 0.15 ? 1 : 0, clicks })
    })
  }
  return rows
}
const daily = buildDaily()

let seq = 100
export function nextId(prefix: string) {
  seq += 1
  return `${prefix}${seq}`
}

export function logAudit(userId: string, action: string, entity: string, target: string, before = '', after = '') {
  audit.unshift({ id: nextId('l'), at: nowStamp(), userId, action, entity, target, before, after })
}

// Password hashes, kept apart from `users` so no API response can include them.
// Every seeded account starts with NUXT_SEED_PASSWORD (or the demo password), hashed at startup.
const SEED_PASSWORD = seedPassword(process.env.NUXT_SEED_PASSWORD)
if (SEED_PASSWORD === DEMO_PASSWORD && process.env.NODE_ENV === 'production')
  console.warn('[auth] Seeded accounts use the public demo password. Set NUXT_SEED_PASSWORD on any server others can reach.')
const credentials = createCredentialStore()
for (const u of users) credentials.seed(u.id, SEED_PASSWORD)

export const db = { users, posters, pages, cards, audit, settings, daily, credentials }

/** Files from the dummy upload route, kept only in memory. */
export const uploads = new Map<string, { type: string; data: Uint8Array }>()
