// Database schema (PostgreSQL, Drizzle ORM). Mirrors the types in shared/types.ts, which stay the API contract.
// Change it, then run `npm run db:generate` to create a migration in server/db/migrations.
// Plain Drizzle, no Nuxt imports: the same schema works in any Node backend.
import { sql } from 'drizzle-orm'
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { PosterDesign } from '#shared/design'
import type { ContactButton, Settings } from '#shared/types'

const ts = (name: string) => timestamp(name, { withTimezone: true })
const createdAt = () => ts('created_at').notNull().defaultNow()

export const roleEnum = pgEnum('role', ['super', 'staff'])
export const userStatusEnum = pgEnum('user_status', ['active', 'locked', 'inactive'])
export const posterKindEnum = pgEnum('poster_kind', ['gambar', 'pengumuman'])
export const publishStatusEnum = pgEnum('publish_status', ['draft', 'published'])
export const posterCategoryEnum = pgEnum('poster_category', ['paket', 'promo', 'acara', 'info'])
export const announcementLevelEnum = pgEnum('announcement_level', ['info', 'penting', 'darurat'])
export const themeEnum = pgEnum('theme', ['ungu', 'merah', 'hijau'])
export const cardStatusEnum = pgEnum('card_status', ['aktif', 'nonaktif'])
export const writeStatusEnum = pgEnum('write_status', ['belum', 'sudah', 'gagal'])

// ---- People and sign-in -------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Stored lower-case (the API lower-cases on input). */
    email: text('email').notNull(),
    role: roleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    lastLogin: ts('last_login'),
    lockedUntil: ts('locked_until'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    createdAt: createdAt(),
  },
  t => [uniqueIndex('users_email_key').on(t.email), check('users_email_lower', sql`${t.email} = lower(${t.email})`)],
)

/** Password hashes, apart from `users` so no query for user data can return them by accident. */
export const credentials = pgTable('credentials', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  salt: text('salt').notNull(),
  hash: text('hash').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

/** Server-side sessions. Only a SHA-256 of the cookie token is stored, so a database leak can't be used to sign in. */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  t => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
)

// ---- Content ------------------------------------------------------------------------

export const posters = pgTable(
  'posters',
  {
    id: text('id').primaryKey(),
    kind: posterKindEnum('kind').notNull(),
    /** Internal name for the team; visitors see `title`. */
    name: text('name').notNull(),
    status: publishStatusEnum('status').notNull().default('draft'),
    archived: boolean('archived').notNull().default(false),
    start: date('start_date', { mode: 'string' }).notNull(),
    end: date('end_date', { mode: 'string' }).notNull(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    // kind = 'gambar'
    imageUrl: text('image_url'),
    imageFile: text('image_file'),
    imageSize: integer('image_size'),
    description: text('description'),
    buttons: text('buttons').array().$type<ContactButton[]>(),
    title: text('title'),
    category: posterCategoryEnum('category'),
    price: text('price'),
    priceUnit: text('price_unit'),
    listTitle: text('list_title'),
    points: text('points').array(),
    terms: text('terms'),
    brochureUrl: text('brochure_url'),
    brochureFile: text('brochure_file'),
    design: jsonb('design').$type<PosterDesign>(),
    // kind = 'pengumuman'
    text: text('text'),
    level: announcementLevelEnum('level'),
    createdAt: createdAt(),
  },
  t => [
    check('posters_dates', sql`${t.end} >= ${t.start}`),
    // What's live is found by status, archive flag and date window.
    index('posters_live_idx').on(t.status, t.archived, t.start, t.end),
  ],
)

export const pages = pgTable(
  'pages',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    theme: themeEnum('theme').notNull().default('ungu'),
    status: publishStatusEnum('status').notNull().default('draft'),
    isDefault: boolean('is_default').notNull().default(false),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    createdAt: createdAt(),
  },
  t => [
    // Names are unique regardless of case, also on rename.
    uniqueIndex('pages_name_key').on(sql`lower(${t.name})`),
    // At most one general page.
    uniqueIndex('pages_one_default')
      .on(t.isDefault)
      .where(sql`${t.isDefault}`),
  ],
)

/** Which posters a page shows, in order. */
export const pagePosters = pgTable(
  'page_posters',
  {
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    posterId: text('poster_id')
      .notNull()
      .references(() => posters.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  t => [primaryKey({ columns: [t.pageId, t.posterId] }), index('page_posters_poster_idx').on(t.posterId)],
)

// ---- NFC cards and visits ---------------------------------------------------------------

export const cards = pgTable(
  'cards',
  {
    code: text('code').primaryKey(),
    label: text('label').notNull(),
    group: text('group_name').notNull(),
    pageId: text('page_id').references(() => pages.id, { onDelete: 'set null' }),
    status: cardStatusEnum('status').notNull().default('aktif'),
    writeStatus: writeStatusEnum('write_status').notNull().default('belum'),
    writtenAt: ts('written_at'),
    writtenBy: text('written_by').references(() => users.id, { onDelete: 'set null' }),
    locked: boolean('locked').notNull().default(false),
    lastTap: ts('last_tap'),
    createdAt: createdAt(),
  },
  t => [check('cards_code_format', sql`${t.code} ~ '^[A-Z0-9]{8}$'`), index('cards_page_idx').on(t.pageId)],
)

/** Taps and contact-button clicks per card per day (no personal data). */
export const dailyStats = pgTable(
  'daily_stats',
  {
    date: date('date', { mode: 'string' }).notNull(),
    cardCode: text('card_code')
      .notNull()
      .references(() => cards.code, { onDelete: 'cascade' }),
    pageId: text('page_id'),
    taps: integer('taps').notNull().default(0),
    bots: integer('bots').notNull().default(0),
    /** key = `${posterId}|${button}` */
    clicks: jsonb('clicks').$type<Record<string, number>>().notNull().default({}),
  },
  t => [primaryKey({ columns: [t.date, t.cardCode] }), index('daily_stats_date_idx').on(t.date)],
)

// ---- Files, audit, settings ---------------------------------------------------------------

/** Uploaded files; the bytes live on disk (the uploads volume), named by `id`. */
export const uploads = pgTable('uploads', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  size: integer('size').notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const audit = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: ts('at').notNull().defaultNow(),
    // Kept when the user is removed: the log must still show what happened.
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    target: text('target').notNull(),
    before: text('before').notNull().default(''),
    after: text('after').notNull().default(''),
  },
  t => [index('audit_at_idx').on(t.at)],
)

/** One row ('site') holding the Settings object; it is validated by settingsSchema before it is saved. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Settings>().notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})
