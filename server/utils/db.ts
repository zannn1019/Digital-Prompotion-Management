// In-memory store for the parts not yet moved to PostgreSQL (posters, pages, cards, analytics, audit,
// settings, uploads). It resets whenever the server restarts. Users, passwords and sessions are in the
// database already (server/repositories/users.ts); the rest follows step by step.
import type { AuditEntry, Card, DailyRow, Page, Poster, Settings } from '#shared/types'
import { nowStamp } from '#shared/utils/format'
import { DEFAULT_SETTINGS } from '../db/defaults'

const posters: Poster[] = []

const pages: Page[] = []

const cards: Card[] = []

const audit: AuditEntry[] = []

const settings: Settings = { ...DEFAULT_SETTINGS }

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

export const db = { posters, pages, cards, audit, settings, daily }

/** Files from the dummy upload route, kept only in memory. */
export const uploads = new Map<string, { type: string; data: Uint8Array }>()
