// The app's database: one connection pool per server process, created on first use.
// Migrations and the seed run once at start-up (server/plugins/database.ts); queries wait for that.
import { resolve } from 'node:path'
import { createDatabase, type Database } from '../db/client'
import { runMigrations, seedDatabase } from '../db/setup'

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
  const { db, ready } = initDatabase()
  await ready
  return db
}
