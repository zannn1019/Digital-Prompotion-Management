// Starting data shared by the in-memory store and the database seed. Plain TypeScript, no Nuxt imports.
import type { Settings } from '#shared/types'

/** The one account that exists on a fresh install. `.test` is a reserved domain, so it can't belong to anyone outside. */
export const SEED_ADMIN = { name: 'Admin', email: 'admin@rs-bethesda.test', role: 'super' as const }

export const DEFAULT_SETTINGS: Settings = {
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
