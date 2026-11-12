// In-memory dummy database. Resets whenever the dev server restarts.
// Replace these collections with real persistence when the backend is ready;
// the API routes are the only code that touches them.
import type { AuditEntry, Card, DailyRow, Page, Poster, Settings, User } from '#shared/types'
import { nowStamp } from '#shared/utils/format'
import { DEMO_PASSWORD, createCredentialStore, seedPassword } from './passwords'

// The app starts empty apart from one Super Admin, who creates posters, pages, cards and users.
// `.test` is a reserved domain, so the address can't belong to anyone outside.
const users: User[] = [{ id: 'u1', name: 'Admin', email: 'admin@rs-bethesda.test', role: 'super', status: 'active', lastLogin: null }]

const posters: Poster[] = []

const pages: Page[] = []

const cards: Card[] = []

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

// Taps and clicks per card per day; filled by real visits (server/utils/visits.ts).
const daily: DailyRow[] = []

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
