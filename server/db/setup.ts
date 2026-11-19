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
export async function seedDatabase(
  db: Database,
  adminPassword: string,
  opts: { mustChangePassword?: boolean } = {},
) {
  await db.transaction(async tx => {
    const [row] = await tx.select({ n: count() }).from(users)
    if (!row?.n) {
      const id = `u${randomBytes(6).toString('hex')}`
      // The demo password is public, so an account seeded with it always has to change it at first sign-in.
      const mustChangePassword =
        !!opts.mustChangePassword ||
        (adminPassword === DEMO_PASSWORD && process.env.NODE_ENV === 'production')
      await tx.insert(users).values({ id, ...SEED_ADMIN, mustChangePassword })
      await tx.insert(credentials).values({ userId: id, ...hashPasswordSync(adminPassword) })
      console.info(
        `[db] Created the first Super Admin: ${SEED_ADMIN.email}${mustChangePassword ? ' (new password required at first sign-in)' : ''}`,
      )
    }
    await tx.insert(settings).values({ key: 'site', value: DEFAULT_SETTINGS }).onConflictDoNothing()
  })
}
