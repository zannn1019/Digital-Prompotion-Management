// Database tests for users, passwords and sessions. They need a real PostgreSQL and run only when
// TEST_DATABASE_URL is set, e.g. with the dev database started by `npm run db:up`:
//   TEST_DATABASE_URL=postgres://poster:poster@127.0.0.1:5432/poster_nfc_test npm test
// The test database is wiped and migrated from scratch first, so never point it at real data.
import { resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../../server/db/client'
import { credentials, sessions, users } from '../../server/db/schema'
import { runMigrations, seedDatabase } from '../../server/db/setup'
import { toStamp } from '../../server/db/time'
import { usersRepo } from '../../server/repositories/users'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('users, passwords and sessions in PostgreSQL', () => {
  let db: Database
  let close: () => Promise<void>
  let repo: ReturnType<typeof usersRepo>

  beforeAll(async () => {
    if (!/_test\b/.test(url!)) throw new Error('TEST_DATABASE_URL must name a database ending in _test: it is wiped.')
    const conn = createDatabase(url!)
    db = conn.db
    close = () => conn.pool.end()
    await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`)
    await runMigrations(db, resolve(process.cwd(), 'server/db/migrations'))
    await seedDatabase(db, 'Rahasia-Tes-2026')
    repo = usersRepo(db)
  })
  afterAll(async () => close?.())

  it('seeds one Super Admin once, with a hashed password', async () => {
    await seedDatabase(db, 'something-else-2026')
    const all = await repo.list()
    expect(all.map(u => [u.email, u.role, u.status])).toEqual([['admin@rs-bethesda.test', 'super', 'active']])
    expect(await repo.verifyPassword(all[0]!.id, 'Rahasia-Tes-2026')).toBe(true)
    expect(await repo.verifyPassword(all[0]!.id, 'something-else-2026')).toBe(false)
    const [row] = await db.select().from(credentials)
    expect(JSON.stringify(row)).not.toContain('Rahasia-Tes-2026')
  })

  it('creates users with unique, lower-case emails', async () => {
    const u = await repo.create({
      name: 'Dimas',
      email: 'Dimas@RS-Bethesda.test',
      role: 'staff',
      password: 'Sementara-123',
      mustChangePassword: true,
    })
    expect(u).toMatchObject({ email: 'dimas@rs-bethesda.test', role: 'staff', status: 'active', mustChangePassword: true })
    expect(await repo.byEmail('DIMAS@rs-bethesda.test')).toMatchObject({ id: u!.id })
    expect(
      await repo.create({
        name: 'Copy',
        email: 'dimas@rs-bethesda.test',
        role: 'staff',
        password: 'x-x-x-x-x-x',
        mustChangePassword: true,
      }),
    ).toBeNull()
  })

  it('checks passwords, and an unknown user never matches', async () => {
    const u = (await repo.byEmail('dimas@rs-bethesda.test'))!
    expect(await repo.verifyPassword(u.id, 'Sementara-123')).toBe(true)
    expect(await repo.verifyPassword(u.id, 'sementara-123')).toBe(false)
    expect(await repo.verifyPassword(undefined, 'Sementara-123')).toBe(false)
    await repo.setPassword(u.id, 'Baru-Sekali-2026')
    expect(await repo.verifyPassword(u.id, 'Sementara-123')).toBe(false)
    expect(await repo.verifyPassword(u.id, 'Baru-Sekali-2026')).toBe(true)
  })

  it('saves lock state and last sign-in, and returns them as strings', async () => {
    const u = (await repo.byEmail('dimas@rs-bethesda.test'))!
    const until = new Date(Date.now() + 15 * 60_000).toISOString()
    await repo.update(u.id, { status: 'locked', lockedUntil: until, lastLogin: new Date('2026-11-13T02:05:00Z') })
    expect(await repo.byId(u.id)).toMatchObject({ status: 'locked', lockedUntil: until, lastLogin: '2026-11-13 09:05' })
    await repo.update(u.id, { status: 'active', lockedUntil: null })
    expect(await repo.byId(u.id)).toMatchObject({ status: 'active', lockedUntil: null })
  })

  it('stores only a hash of the session token, and expired sessions do not count', async () => {
    const u = (await repo.byEmail('dimas@rs-bethesda.test'))!
    await repo.createSession('token-live', u.id, new Date(Date.now() + 60_000))
    await repo.createSession('token-old', u.id, new Date(Date.now() - 1_000))
    expect((await repo.sessionUser('token-live'))?.user.id).toBe(u.id)
    expect(await repo.sessionUser('token-old')).toBeNull()
    expect(await repo.sessionUser('token-unknown')).toBeNull()
    const rows = await db.select().from(sessions)
    expect(rows.map(r => r.tokenHash)).not.toContain('token-live')
  })

  it('ends all sessions of a user, and removing a user removes them too', async () => {
    const u = (await repo.byEmail('dimas@rs-bethesda.test'))!
    await repo.createSession('token-a', u.id, new Date(Date.now() + 60_000))
    await repo.deleteUserSessions(u.id)
    expect(await repo.sessionUser('token-a')).toBeNull()
    await repo.createSession('token-b', u.id, new Date(Date.now() + 60_000))
    await db.delete(users).where(sql`${users.id} = ${u.id}`)
    expect(
      await db
        .select()
        .from(sessions)
        .where(sql`${sessions.userId} = ${u.id}`),
    ).toEqual([])
    expect(
      await db
        .select()
        .from(credentials)
        .where(sql`${credentials.userId} = ${u.id}`),
    ).toEqual([])
  })

  it('maps user ids to names', async () => {
    const names = await repo.names()
    expect([...names.values()]).toEqual(['Admin'])
  })
})

describe('timestamps', () => {
  it('are shown in Jakarta time', () => {
    expect(toStamp(new Date('2026-11-12T17:30:00Z'))).toBe('2026-11-13 00:30')
    expect(toStamp(null)).toBeNull()
  })
})
