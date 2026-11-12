// Labels and display options shared by the app and the server, kept in one place.
import type { AnnouncementLevel, ContactButton, PosterCategory, PosterState, Role, Theme, UserStatus, WriteStatus } from './types'

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted'

export const ROLE_LABEL: Record<Role, string> = { super: 'Super Admin', staff: 'Staff Konten' }

/**
 * Header a server-rendered poster page uses to tell its own API call who the visitor is, so a tap is
 * counted per visitor. The server only reads it on internal requests (see server/utils/clientIp.ts).
 */
export const VISITOR_IP_HEADER = 'x-nfc-visitor'

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  active: { label: 'Aktif', tone: 'success' },
  locked: { label: 'Terkunci', tone: 'danger' },
  inactive: { label: 'Nonaktif', tone: 'muted' },
}

export const POSTER_STATE: Record<PosterState, { label: string; tone: Tone }> = {
  tayang: { label: 'Sedang tayang', tone: 'success' },
  terjadwal: { label: 'Terjadwal', tone: 'info' },
  draft: { label: 'Draft', tone: 'warning' },
  berakhir: { label: 'Berakhir', tone: 'muted' },
  arsip: { label: 'Diarsipkan', tone: 'muted' },
}

export const WRITE_STATUS: Record<WriteStatus, { label: string; tone: Tone }> = {
  sudah: { label: 'Sudah ditulis', tone: 'success' },
  belum: { label: 'Belum ditulis', tone: 'muted' },
  gagal: { label: 'Perlu dicek', tone: 'danger' },
}

export const CONTACT_BUTTON: Record<ContactButton, string> = {
  wa: 'WhatsApp Marketing',
  tel: 'Telepon Marketing',
  email: 'Email Marketing',
  doc: 'Unduh Brosur (PDF)',
}
export const CONTACT_BUTTON_ORDER: ContactButton[] = ['wa', 'tel', 'email', 'doc']

/** Label on the big bottom-bar button of the visitor page. */
export const CONTACT_CTA: Record<ContactButton, string> = {
  wa: 'Tanya via WhatsApp',
  tel: 'Telepon Marketing',
  email: 'Email Marketing',
  doc: 'Unduh brosur (PDF)',
}

export const POSTER_CATEGORY: Record<PosterCategory, string> = {
  paket: 'Paket layanan',
  promo: 'Promo',
  acara: 'Acara',
  info: 'Info layanan',
}

/** Limits for the visitor-page details. The server checks them again. */
export const POSTER_LIMITS = { title: 60, description: 300, price: 40, priceUnit: 30, listTitle: 40, points: 6, point: 100, terms: 500 }

/** Poster page colour themes (white text passes WCAG AA on each background). */
export const THEMES: Record<Theme, { label: string; bg: string; accent: string; ink: string }> = {
  ungu: { label: 'Ungu', bg: 'linear-gradient(172deg,#120a2b 0%,#2a1263 48%,#4c1d95 100%)', accent: '#5eead4', ink: '#062521' },
  merah: { label: 'Merah', bg: 'linear-gradient(172deg,#1c0408 0%,#540b18 48%,#8a1125 100%)', accent: '#ffd23f', ink: '#2a1600' },
  hijau: { label: 'Hijau', bg: 'linear-gradient(172deg,#03150e 0%,#073b29 48%,#0a5a3f 100%)', accent: '#d9f99d', ink: '#12290a' },
}

export const ANNOUNCEMENT_LEVEL: Record<AnnouncementLevel, { label: string; bar: string; swatch: string }> = {
  info: { label: 'Informasi', bar: 'bg-brand-tint text-brand-navy', swatch: 'bg-brand-tint' },
  penting: { label: 'Penting', bar: 'bg-amber-100 text-amber-950', swatch: 'bg-amber-100' },
  darurat: { label: 'Darurat', bar: 'bg-brand-red text-white', swatch: 'bg-brand-red' },
}

/** Upload rules (FR-15). The server re-checks them. */
export const UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  types: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  accept: 'image/png,image/jpeg,image/webp,application/pdf',
}
