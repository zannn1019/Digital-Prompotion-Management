// Shared between the Nuxt app and the server routes.
import type { PosterDesign } from './design'

export type Role = 'super' | 'staff'
export type UserStatus = 'active' | 'locked' | 'inactive'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  lastLogin: string | null
  /** Set after 5 failed logins; the account unlocks itself after this time. */
  lockedUntil?: string | null
  /** Signed in with a temporary password: must choose a new one before doing anything else. */
  mustChangePassword?: boolean
}

export type PosterKind = 'gambar' | 'pengumuman'
export type PublishStatus = 'draft' | 'published'
export type ContactButton = 'wa' | 'tel' | 'email' | 'doc'
export type AnnouncementLevel = 'info' | 'penting' | 'darurat'
export type PosterCategory = 'paket' | 'promo' | 'acara' | 'info'

export interface Poster {
  id: string
  kind: PosterKind
  name: string
  status: PublishStatus
  archived: boolean
  /** Status just before archiving, so "Urungkan" can put it back exactly. Cleared on restore. */
  archivedFrom?: PublishStatus
  start: string
  end: string
  updatedAt: string
  updatedBy: string
  // kind = 'gambar' (finished poster image)
  imageUrl?: string
  imageFile?: string
  imageSize?: number
  description?: string
  buttons?: ContactButton[]
  // Visitor-page details (promo-detail layout). Empty optional fields are simply not shown.
  /** Public title; `name` stays internal to the team. */
  title?: string
  category?: PosterCategory
  price?: string
  priceUnit?: string
  listTitle?: string
  points?: string[]
  terms?: string
  /** Poster-specific brochure; the "doc" button falls back to Settings when empty. */
  brochureUrl?: string | null
  brochureFile?: string
  /** Set when the image was made in the canvas editor, so it can be edited again. Admin only. */
  design?: PosterDesign | null
  // kind = 'pengumuman'
  text?: string
  level?: AnnouncementLevel
}

/** Derived from status, archive flag and schedule window. */
export type PosterState = 'tayang' | 'terjadwal' | 'berakhir' | 'draft' | 'arsip'

export type Theme = 'ungu' | 'merah' | 'hijau'

export interface Page {
  id: string
  name: string
  theme: Theme
  status: PublishStatus
  isDefault: boolean
  posterIds: string[]
  updatedAt: string
}

export type CardStatus = 'aktif' | 'nonaktif'
export type WriteStatus = 'belum' | 'sudah' | 'gagal'

export interface Card {
  code: string
  label: string
  group: string
  pageId: string | null
  status: CardStatus
  writeStatus: WriteStatus
  writtenAt: string | null
  writtenBy: string | null
  locked: boolean
  lastTap: string | null
}

export interface AuditEntry {
  id: string
  at: string
  userId: string
  action: string
  entity: string
  target: string
  before: string
  after: string
}

export interface Settings {
  company: string
  tagline: string
  /** Logo image (transparent PNG works best on the white header). */
  logoUrl: string
  address: string
  wa: string
  phone: string
  email: string
  hours: string
  website: string
  brochure: string
  retentionAudit: number
  retentionTap: number
  baseUrl: string
}

export interface DailyRow {
  date: string
  card: string
  pageId: string
  taps: number
  bots: number
  /** key = `${posterId}|${button}` */
  clicks: Record<string, number>
}

/** The poster fields visitors receive. Internal ones (name, author, file names, status) stay on the server. */
export const PUBLIC_POSTER_FIELDS = [
  'id',
  'kind',
  'end',
  'imageUrl',
  'description',
  'buttons',
  'title',
  'category',
  'price',
  'priceUnit',
  'listTitle',
  'points',
  'terms',
  'text',
  'level',
] as const satisfies readonly (keyof Poster)[]

/** `name` is only set in the admin previews, which render full posters. */
export type PublicPoster = Pick<Poster, (typeof PUBLIC_POSTER_FIELDS)[number]> & { name?: string }

/** What a phone sees after tapping a card. */
export interface PublicView {
  kind: 'page' | 'fallback' | 'notfound'
  posters: PublicPoster[]
  announcements: PublicPoster[]
  settings: Pick<Settings, 'company' | 'tagline' | 'logoUrl' | 'address' | 'wa' | 'phone' | 'email' | 'hours' | 'website' | 'brochure'>
}
