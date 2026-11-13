// Site settings and the audit log in PostgreSQL. Plain TypeScript on Drizzle (no Nuxt imports).
import { desc, eq, ne } from 'drizzle-orm'
import type { AuditEntry, Settings } from '#shared/types'
import type { Database } from '../db/client'
import { DEFAULT_SETTINGS } from '../db/defaults'
import { audit, settings } from '../db/schema'
import { toStamp } from '../db/time'

const KEY = 'site'

export function settingsRepo(db: Database) {
  return {
    /** The settings, with defaults for any key added after the row was saved. */
    async get(): Promise<Settings> {
      const [row] = await db.select().from(settings).where(eq(settings.key, KEY))
      return { ...DEFAULT_SETTINGS, ...row?.value }
    },

    /** Saves the given fields; returns the new settings and which keys actually changed. */
    async update(patch: Partial<Settings>): Promise<{ settings: Settings; changed: (keyof Settings)[] }> {
      return db.transaction(async tx => {
        const [row] = await tx.select().from(settings).where(eq(settings.key, KEY)).for('update')
        const current: Settings = { ...DEFAULT_SETTINGS, ...row?.value }
        const changed = (Object.keys(patch) as (keyof Settings)[]).filter(k => patch[k] !== current[k])
        const next = { ...current, ...patch }
        await tx
          .insert(settings)
          .values({ key: KEY, value: next })
          .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } })
        return { settings: next, changed }
      })
    },
  }
}

type AuditRow = typeof audit.$inferSelect
const toEntry = (r: AuditRow): AuditEntry => ({
  id: String(r.id),
  at: toStamp(r.at) ?? '',
  userId: r.userId ?? '',
  action: r.action,
  entity: r.entity,
  target: r.target,
  before: r.before,
  after: r.after,
})

export function auditRepo(db: Database) {
  return {
    async log(userId: string, action: string, entity: string, target: string, before = '', after = ''): Promise<void> {
      await db.insert(audit).values({ userId, action, entity, target, before, after })
    },

    /** Newest first. The Audit Log page shows at most this many. */
    async list(limit = 2000): Promise<AuditEntry[]> {
      return (await db.select().from(audit).orderBy(desc(audit.at), desc(audit.id)).limit(limit)).map(toEntry)
    },

    /** Latest changes for the dashboard, without sign-ins. */
    async recentChanges(limit = 5): Promise<AuditEntry[]> {
      return (await db.select().from(audit).where(ne(audit.entity, 'Sesi')).orderBy(desc(audit.at), desc(audit.id)).limit(limit)).map(
        toEntry,
      )
    },
  }
}
