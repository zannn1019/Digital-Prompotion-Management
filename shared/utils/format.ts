import type { Poster, PosterState } from '../types'

// The app's calendar runs on Jakarta time (WIB): "today" changes at midnight WIB, on the server
// and in every browser, whatever their own time zone.
const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
const JAKARTA_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Today's date in Jakarta, as YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return JAKARTA_DATE.format(now)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function parse(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`)
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = parse(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateShort(iso: string) {
  const d = parse(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function fmtDateLong(iso: string) {
  const d = parse(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

export function fmtDateTime(s: string | null | undefined) {
  if (!s) return '—'
  return `${fmtDate(s)}, ${s.slice(11, 16).replace(':', '.')}`
}

export function fmtRange(a: string, b: string) {
  return `${fmtDate(a)} – ${fmtDate(b)}`
}

export function daysBetween(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

export function addDays(iso: string, n: number) {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function relDays(iso: string, from: string = today()) {
  const n = daysBetween(from, iso)
  if (n === 0) return 'hari ini'
  if (n === 1) return 'besok'
  if (n === -1) return 'kemarin'
  return n > 0 ? `dalam ${n} hari` : `${-n} hari lalu`
}

export function fmtNumber(n: number) {
  return n.toLocaleString('id-ID')
}

export function fmtBytes(n: number) {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.round(n / 1000)} KB`
}

export function posterState(p: Poster, on: string = today()): PosterState {
  if (p.archived) return 'arsip'
  if (p.status !== 'published') return 'draft'
  if (p.start > on) return 'terjadwal'
  if (p.end < on) return 'berakhir'
  return 'tayang'
}

/** Now in Jakarta, as `YYYY-MM-DD HH:mm`. */
export function nowStamp(now: Date = new Date()): string {
  return `${today(now)} ${JAKARTA_TIME.format(now)}`
}
