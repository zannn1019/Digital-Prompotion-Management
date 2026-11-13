// The app's database: one connection pool per server process, created on first use.
// Migrations and the seed run once at start-up (server/plugins/database.ts); queries wait for that.
import { resolve } from 'node:path'
import { createDatabase, type Database } from '../db/client'
import { runMigrations, seedDatabase } from '../db/setup'
import { usersRepo } from '../repositories/users'
import { auditRepo, settingsRepo } from '../repositories/settings'
import { contentRepo } from '../repositories/content'
import { cardsRepo } from '../repositories/cards'
import { uploadsRepo } from '../repositories/uploads'

let instance: { db: Database; ready: Promise<void> } | null = null

/** True when NUXT_DATABASE_URL is set. Until every route uses the database, the in-memory store is the fallback. */
export function databaseConfigured(): boolean {
  return !!useRuntimeConfig().databaseUrl
}

/** Starts the pool and the migrations once; later calls return the same instance. */
export function initDatabase() {
  if (instance) return instance
  const url = useRuntimeConfig().databaseUrl
  if (!url) throw new Error('NUXT_DATABASE_URL is not set.')
  const { db } = createDatabase(url)
  // Migrations ship with the app: server/db/migrations next to the working directory (also in the Docker image).
  const ready = runMigrations(db, resolve(process.cwd(), 'server/db/migrations')).then(() =>
    seedDatabase(db, seedPassword(process.env.NUXT_SEED_PASSWORD)),
  )
  instance = { db, ready }
  return instance
}

/** The database, once migrations and the seed are done. */
export async function useDrizzle(): Promise<Database> {
  if (!databaseConfigured())
    throw createError({
      statusCode: 503,
      statusMessage: 'Database belum diatur.',
      message: 'NUXT_DATABASE_URL is not set. For local development run `npm run db:up` and set it in .env (see README).',
    })
  const { db, ready } = initDatabase()
  await ready
  return db
}

/** Users, passwords and sessions (server/repositories/users.ts). */
export async function useUsers() {
  return usersRepo(await useDrizzle())
}

/** Site settings (server/repositories/settings.ts). */
export async function useSettingsRepo() {
  return settingsRepo(await useDrizzle())
}

/** Posters, announcements and pages (server/repositories/content.ts). */
export async function useContent() {
  return contentRepo(await useDrizzle())
}

/** Records one entry in the audit log. */
export async function logAudit(userId: string, action: string, entity: string, target: string, before = '', after = '') {
  await auditRepo(await useDrizzle()).log(userId, action, entity, target, before, after)
}

/** The audit log for reading (server/repositories/settings.ts). */
export async function useAudit() {
  return auditRepo(await useDrizzle())
}

/** NFC cards and their tap/click counts (server/repositories/cards.ts). */
export async function useCardsRepo() {
  return cardsRepo(await useDrizzle())
}

/**
 * Uploaded files (server/repositories/uploads.ts). The bytes go to NUXT_UPLOAD_DIR
 * (the Docker image uses a volume at /app/uploads), else `.data/uploads` next to the app.
 */
export async function useUploads() {
  const dir = useRuntimeConfig().uploadDir || resolve(process.cwd(), '.data/uploads')
  return uploadsRepo(await useDrizzle(), dir)
}
