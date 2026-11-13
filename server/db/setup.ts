// Brings a database up to date: applies pending migrations, then adds the starting data once.
// Plain Node code (no Nuxt imports).
import { randomBytes } from 'node:crypto'
import { count } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { DEMO_PASSWORD, hashPasswordSync } from '../utils/passwords'
import type { Database } from './client'
import { DEFAULT_SETTINGS, SEED_ADMIN } from './defaults'
import { credentials, settings, users } from './schema'

export async function runMigrations(db: Database, migrationsFolder: string) {
  await migrate(db, { migrationsFolder })
}

/** Adds the first Super Admin and the default settings when they don't exist yet. Safe to run on every start. */
export async function seedDatabase(db: Database, adminPassword: string) {
  await db.transaction(async tx => {
    const [row] = await tx.select({ n: count() }).from(users)
    if (!row?.n) {
      const id = `u${randomBytes(6).toString('hex')}`
      await tx.insert(users).values({ id, ...SEED_ADMIN })
      await tx.insert(credentials).values({ userId: id, ...hashPasswordSync(adminPassword) })
      console.info(`[db] Created the first Super Admin: ${SEED_ADMIN.email}`)
      if (adminPassword === DEMO_PASSWORD && process.env.NODE_ENV === 'production')
        console.warn('[auth] The first Super Admin has the public demo password. Change it now, or set NUXT_SEED_PASSWORD.')
    }
    await tx.insert(settings).values({ key: 'site', value: DEFAULT_SETTINGS }).onConflictDoNothing()
  })
}
