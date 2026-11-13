// Users, their password hashes and their sessions in PostgreSQL.
// Plain TypeScript on top of Drizzle (no Nuxt imports), so it moves to any Node backend as is.
import { createHash, randomBytes } from 'node:crypto'
import { and, asc, eq, gt, lt } from 'drizzle-orm'
import type { Role, User, UserStatus } from '#shared/types'
import type { Database } from '../db/client'
import { credentials, sessions, users } from '../db/schema'
import { toIso, toStamp } from '../db/time'
import { hashPassword, verifyPassword } from '../utils/passwords'

type UserRow = typeof users.$inferSelect

/** The User shape the API returns (dates as strings, like before). */
function toUser(r: UserRow): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    lastLogin: toStamp(r.lastLogin),
    lockedUntil: toIso(r.lockedUntil),
    mustChangePassword: r.mustChangePassword,
  }
}

/** Only a SHA-256 of the cookie token is stored. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url')

export function usersRepo(db: Database) {
  return {
    async list(): Promise<User[]> {
      return (await db.select().from(users).orderBy(asc(users.createdAt))).map(toUser)
    },

    async byId(id: string): Promise<User | null> {
      const [r] = await db.select().from(users).where(eq(users.id, id))
      return r ? toUser(r) : null
    },

    async byEmail(email: string): Promise<User | null> {
      const [r] = await db.select().from(users).where(eq(users.email, email.toLowerCase()))
      return r ? toUser(r) : null
    },

    /** id → name, for showing who changed what. Small table, so one query. */
    async names(): Promise<Map<string, string>> {
      return new Map((await db.select({ id: users.id, name: users.name }).from(users)).map(r => [r.id, r.name]))
    },

    /** Creates a user with a password (stored as a hash). Returns null when the email is taken. */
    async create(input: { name: string; email: string; role: Role; password: string; mustChangePassword: boolean }): Promise<User | null> {
      const id = `u${randomBytes(6).toString('hex')}`
      const hash = await hashPassword(input.password)
      return db.transaction(async tx => {
        const [row] = await tx
          .insert(users)
          .values({
            id,
            name: input.name,
            email: input.email.toLowerCase(),
            role: input.role,
            mustChangePassword: input.mustChangePassword,
          })
          .onConflictDoNothing({ target: users.email })
          .returning()
        if (!row) return null
        await tx.insert(credentials).values({ userId: id, ...hash })
        return toUser(row)
      })
    },

    /** Saves the fields the API changes on a user. */
    async update(
      id: string,
      fields: Partial<{ role: Role; status: UserStatus; lockedUntil: string | null; mustChangePassword: boolean; lastLogin: Date }>,
    ): Promise<void> {
      const { lockedUntil, ...rest } = fields
      await db
        .update(users)
        .set({ ...rest, ...(lockedUntil !== undefined ? { lockedUntil: lockedUntil ? new Date(lockedUntil) : null } : {}) })
        .where(eq(users.id, id))
    },

    // ---- Passwords ----

    /** Checks a password. An unknown user is checked against a stand-in hash, so it takes as long. */
    async verifyPassword(userId: string | undefined, password: string): Promise<boolean> {
      const [stored] = userId ? await db.select().from(credentials).where(eq(credentials.userId, userId)) : []
      return verifyPassword(password, stored)
    },

    async setPassword(userId: string, password: string): Promise<void> {
      const hash = await hashPassword(password)
      await db
        .insert(credentials)
        .values({ userId, ...hash })
        .onConflictDoUpdate({ target: credentials.userId, set: { ...hash, updatedAt: new Date() } })
    },

    // ---- Sessions ----

    async createSession(token: string, userId: string, expiresAt: Date): Promise<void> {
      // Expired sessions are cleared on the way, so the table doesn't grow.
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
      await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt })
    },

    /** The user of a live session, with its expiry; null when unknown or expired. */
    async sessionUser(token: string): Promise<{ user: User; expiresAt: Date } | null> {
      const [r] = await db
        .select({ user: users, expiresAt: sessions.expiresAt })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      return r ? { user: toUser(r.user), expiresAt: r.expiresAt } : null
    },

    async extendSession(token: string, expiresAt: Date): Promise<void> {
      await db
        .update(sessions)
        .set({ expiresAt })
        .where(eq(sessions.tokenHash, hashToken(token)))
    },

    async deleteSession(token: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
    },

    /** Ends every session of a user, e.g. after deactivation, a role change or a password reset. */
    async deleteUserSessions(userId: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.userId, userId))
    },
  }
}

export type UsersRepo = ReturnType<typeof usersRepo>
