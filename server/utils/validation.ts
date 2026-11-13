import type { H3Event } from 'h3'
import { z } from 'zod'
import { MAX_ELEMENTS, MAX_FONT, MIN_FONT } from '#shared/design'
import { POSTER_LIMITS } from '#shared/constants'
import { today, addDays, daysBetween, fmtDate } from '#shared/utils/format'
import { MIN_PASSWORD_LENGTH } from './passwords'

// Every write endpoint parses its body through a strict schema: unknown fields
// are rejected (no mass assignment) and each field has a type and limit.

const REQUIRED = 'Isian ini wajib diisi.'
const tooLong = (max: number) => `Terlalu panjang. Maksimal ${max} karakter.`
const text = (max: number) => z.string({ error: REQUIRED }).trim().max(max, tooLong(max))
const requiredText = (max: number) => text(max).min(1, REQUIRED)
const isoDate = z.string({ error: REQUIRED }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal belum benar.')
/** Only files served by our own upload route (random 128-bit IDs) or the bundled dummies. */
const ownImage = z.string().regex(/^(\/api\/uploads\/f[0-9a-f]{32}|\/dummy\/[a-z0-9-]+\.svg)$/, 'Unggah file poster terlebih dahulu.')
const ownFile = z.string().regex(/^\/api\/uploads\/f[0-9a-f]{32}$/, 'Unggah file terlebih dahulu.')
const ownLogo = z.string().regex(/^(\/api\/uploads\/f[0-9a-f]{32}|\/brand\/[a-z0-9-]+\.png)$/, 'Unggah logo terlebih dahulu.')
const optional = (max: number) => text(max).optional()

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const num = (min: number, max: number) => z.number().finite().min(min).max(max)
const elementBase = { id: z.string().regex(/^[a-z0-9]{1,16}$/), x: num(-2000, 3000), y: num(-2000, 3000), rotation: num(-360, 360) }
const box = { width: num(10, 3000), height: num(10, 3000) }

/** Canvas-editor design. Bounded everywhere so a crafted design cannot bloat storage. */
export const designSchema = z
  .object({
    version: z.literal(1),
    background: z.object({ top: hex, bottom: hex }).strict(),
    elements: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              ...elementBase,
              type: z.literal('text'),
              width: num(40, 3000),
              text: z.string().max(300),
              fontSize: num(MIN_FONT, MAX_FONT),
              bold: z.boolean(),
              fill: hex,
              align: z.enum(['left', 'center', 'right']),
            })
            .strict(),
          z
            .object({
              ...elementBase,
              type: z.literal('label'),
              text: z.string().max(80),
              fontSize: num(MIN_FONT, MAX_FONT),
              fill: hex,
              background: hex,
            })
            .strict(),
          z.object({ ...elementBase, ...box, type: z.literal('rect'), fill: hex, cornerRadius: num(0, 1500) }).strict(),
          z.object({ ...elementBase, ...box, type: z.literal('image'), src: ownImage, cornerRadius: num(0, 1500) }).strict(),
          z.object({ ...elementBase, type: z.enum(['logo', 'info']), width: num(200, 3000) }).strict(),
        ]),
      )
      .max(MAX_ELEMENTS),
  })
  .strict()

const dateOrder = <T extends { start?: string; end?: string }>(v: T, ctx: z.RefinementCtx) => {
  if (v.start && v.end && v.end < v.start)
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'Tanggal berakhir harus sama atau setelah tanggal mulai.' })
}

const posterBase = {
  status: z.enum(['draft', 'published']),
  start: isoDate,
  end: isoDate,
}

export const imagePosterSchema = z
  .object({
    kind: z.literal('gambar'),
    ...posterBase,
    name: requiredText(80),
    imageUrl: ownImage,
    imageFile: text(160).optional(),
    imageSize: z
      .number()
      .int()
      .nonnegative()
      .max(5 * 1024 * 1024)
      .optional(),
    description: z
      .string({ error: 'Isian ini wajib. Tulis 1–2 kalimat penjelasan.' })
      .trim()
      .min(1, 'Isian ini wajib. Tulis 1–2 kalimat penjelasan.')
      .max(POSTER_LIMITS.description, tooLong(POSTER_LIMITS.description)),
    buttons: z
      .array(z.enum(['wa', 'tel', 'email', 'doc']))
      .max(4)
      .refine(a => new Set(a).size === a.length, 'Tombol ganda.'),
    pageIds: z.array(z.string().max(40)).max(100).optional(),
    // Visitor-page details.
    title: requiredText(POSTER_LIMITS.title),
    category: z.enum(['paket', 'promo', 'acara', 'info']).optional(),
    price: optional(POSTER_LIMITS.price),
    priceUnit: optional(POSTER_LIMITS.priceUnit),
    listTitle: optional(POSTER_LIMITS.listTitle),
    points: z.array(text(POSTER_LIMITS.point)).max(POSTER_LIMITS.points, `Maksimal ${POSTER_LIMITS.points} poin.`).optional(),
    terms: optional(POSTER_LIMITS.terms),
    brochureUrl: ownFile.nullable().optional(),
    brochureFile: optional(160),
    design: designSchema.nullable().optional(),
  })
  .strict()
  .superRefine(dateOrder)

export const announcementSchema = z
  .object({
    kind: z.literal('pengumuman'),
    ...posterBase,
    name: text(80).optional(),
    text: requiredText(140),
    level: z.enum(['info', 'penting', 'darurat']),
  })
  .strict()
  .superRefine(dateOrder)

export const posterSchema = z.discriminatedUnion('kind', [imagePosterSchema, announcementSchema])

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254),
    password: z.string().max(200),
  })
  .strict()

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string({ error: REQUIRED }).min(1, REQUIRED).max(200),
    newPassword: z.string({ error: REQUIRED }).min(MIN_PASSWORD_LENGTH, `Minimal ${MIN_PASSWORD_LENGTH} karakter.`).max(200, tooLong(200)),
  })
  .strict()
  .refine(v => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Kata sandi baru harus berbeda dari yang lama.',
  })

export const pageCreateSchema = z
  .object({
    name: requiredText(80),
  })
  .strict()

export const pageUpdateSchema = z
  .object({
    posterIds: z.array(z.string().max(40)).max(50).optional(),
    isDefault: z.literal(true).optional(),
    status: z.enum(['draft', 'published']).optional(),
    name: requiredText(80).optional(),
    theme: z.enum(['ungu', 'merah', 'hijau']).optional(),
  })
  .strict()

export const cardRegisterSchema = z
  .object({
    count: z
      .number({ error: 'Jumlah kartu antara 1 dan 50.' })
      .int()
      .min(1, 'Jumlah kartu antara 1 dan 50.')
      .max(50, 'Jumlah kartu antara 1 dan 50.'),
    label: requiredText(80),
    group: requiredText(80),
    pageId: z.string().max(40).nullable(),
  })
  .strict()

export const cardBulkSchema = z
  .object({
    action: z.enum(['map', 'deactivate', 'activate']),
    codes: z
      .array(z.string().regex(/^[A-Z0-9]{8}$/))
      .min(1, 'Pilih minimal satu kartu.')
      .max(500),
    pageId: z.string().max(40).nullable().optional(),
  })
  .strict()

export const cardWriteSchema = z.object({ ok: z.boolean(), locked: z.boolean().optional() }).strict()

export const userCreateSchema = z
  .object({
    name: requiredText(80),
    email: z.email('Format email belum benar. Contoh: nama@rs-bethesda.test').trim().toLowerCase().max(254),
    role: z.enum(['super', 'staff']),
  })
  .strict()

export const userPatchSchema = z
  .object({
    role: z.enum(['super', 'staff']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    resetPassword: z.literal(true).optional(),
  })
  .strict()

const https = z
  .string()
  .trim()
  .regex(/^https:\/\/[^\s]+\.[^\s]+$/, 'Alamat tautan harus diawali https://')
  .max(300)
export const settingsSchema = z
  .object({
    company: requiredText(80),
    tagline: text(40),
    logoUrl: ownLogo,
    address: text(160),
    wa: z
      .string()
      .trim()
      .regex(/^62\d{8,13}$/, 'Gunakan format 62… tanpa + atau tanda hubung. Contoh: 628000000001'),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{6,20}$/, 'Nomor hanya boleh berisi angka, spasi, +, atau -.'),
    email: z.email('Format email belum benar.').trim(),
    hours: text(80),
    website: https,
    brochure: https,
    retentionAudit: z.union([z.literal(90), z.literal(180), z.literal(365), z.literal(730)]),
    retentionTap: z.union([z.literal(365), z.literal(730)]),
  })
  .partial()
  .strict()

/** "Perpanjang" may move a poster's end date at most this many days past its current end. */
export const MAX_EXTEND_DAYS = 366

/** Why a new end date for "Perpanjang" is refused, or null when it is fine. */
export function extendEndProblem(currentEnd: string, nextEnd: string): string | null {
  if (nextEnd <= currentEnd) return `Pilih tanggal setelah ${fmtDate(currentEnd)}.`
  if (daysBetween(currentEnd, nextEnd) > MAX_EXTEND_DAYS) return `Maksimal 1 tahun setelah ${fmtDate(currentEnd)}.`
  return null
}

/** Longest analytics range, so one request can't make the server build years of empty days. */
export const MAX_ANALYTICS_DAYS = 366

/** A real calendar day (YYYY-MM-DD), not just the right shape: 2026-02-30 is refused. */
const calendarDate = isoDate.refine(s => addDays(s, 0) === s, 'Tanggal belum benar.')
/** Query values are strings; an emptied date field arrives as '' and means "use the default". */
const optionalDate = z.preprocess(v => (v === '' ? undefined : v), calendarDate.optional())

export const analyticsQuerySchema = z
  .object({ from: optionalDate, to: optionalDate })
  .transform(q => {
    const to = q.to ?? today()
    return { to, from: q.from ?? addDays(to, -29) }
  })
  .superRefine((v, ctx) => {
    if (v.from > v.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Tanggal mulai harus sama atau sebelum tanggal akhir.' })
    else if (daysBetween(v.from, v.to) + 1 > MAX_ANALYTICS_DAYS)
      ctx.addIssue({ code: 'custom', path: ['from'], message: `Rentang maksimal ${MAX_ANALYTICS_DAYS} hari.` })
  })

/** Field problems become a 422 with `data.errors = { field: message }`, which the forms show inline. */
function invalid(issues: z.core.$ZodIssue[]): never {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '_')
    errors[key] ??= issue.message
  }
  throw createError({ statusCode: 422, statusMessage: 'Periksa isian', data: { errors } })
}

/** Parses the JSON body with a schema. */
export async function parseBody<S extends z.ZodType>(event: H3Event, schema: S): Promise<z.infer<S>> {
  const result = schema.safeParse(await readBody(event))
  return result.success ? result.data : invalid(result.error.issues)
}

/** Parses the query string with a schema. */
export function parseQuery<S extends z.ZodType>(event: H3Event, schema: S): z.infer<S> {
  const result = schema.safeParse(getQuery(event))
  return result.success ? result.data : invalid(result.error.issues)
}
