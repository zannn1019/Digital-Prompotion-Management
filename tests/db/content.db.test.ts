// Database tests for settings, the audit log, posters, pages, cards, daily counts and uploads.
// Run with TEST_DATABASE_URL (see tests/db/users.db.test.ts); skipped without it. The test database is wiped first.
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PosterFields } from '../../server/repositories/content'
import { createDatabase, type Database } from '../../server/db/client'
import { runMigrations, seedDatabase } from '../../server/db/setup'
import { DEFAULT_SETTINGS } from '../../server/db/defaults'
import { auditRepo, settingsRepo } from '../../server/repositories/settings'
import { contentRepo } from '../../server/repositories/content'
import { cardsRepo } from '../../server/repositories/cards'
import { uploadsRepo } from '../../server/repositories/uploads'
import { usersRepo } from '../../server/repositories/users'

const url = process.env.TEST_DATABASE_URL

const image = (title: string, extra: Partial<PosterFields> = {}): PosterFields => ({
  kind: 'gambar',
  status: 'published',
  name: title,
  title,
  description: 'Deskripsi',
  imageUrl: '/dummy/sleep-lab.svg',
  buttons: ['wa'],
  start: '2026-01-01',
  end: '2026-12-31',
  ...extra,
})

describe.skipIf(!url)('content in PostgreSQL', () => {
  let db: Database
  let close: () => Promise<void>
  let adminId: string
  let uploadDir: string

  beforeAll(async () => {
    if (!/_test\b/.test(url!)) throw new Error('TEST_DATABASE_URL must name a database ending in _test: it is wiped.')
    const conn = createDatabase(url!)
    db = conn.db
    close = () => conn.pool.end()
    await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`)
    await runMigrations(db, resolve(process.cwd(), 'server/db/migrations'))
    await seedDatabase(db, 'Rahasia-Tes-2026')
    adminId = (await usersRepo(db).list())[0]!.id
    uploadDir = await mkdtemp(join(tmpdir(), 'poster-uploads-'))
  })
  afterAll(async () => {
    await close?.()
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true })
  })

  it('keeps settings across saves and reports what changed', async () => {
    const repo = settingsRepo(db)
    expect(await repo.get()).toEqual(DEFAULT_SETTINGS)
    const { settings, changed } = await repo.update({ company: 'RS Uji', hours: DEFAULT_SETTINGS.hours })
    expect(changed).toEqual(['company'])
    expect(settings.company).toBe('RS Uji')
    expect((await repo.get()).company).toBe('RS Uji')
  })

  it('logs audit entries newest first, and the dashboard list leaves out sign-ins', async () => {
    const repo = auditRepo(db)
    await repo.log(adminId, 'Masuk', 'Sesi', 'Panel Admin')
    await repo.log(adminId, 'Membuat', 'Poster', 'A')
    expect((await repo.list()).map(a => a.action).slice(0, 2)).toEqual(['Membuat', 'Masuk'])
    expect((await repo.recentChanges()).map(a => a.entity)).not.toContain('Sesi')
  })

  it('creates posters, places them on pages in order and round-trips every field', async () => {
    const repo = contentRepo(db)
    const page = (await repo.createPage('Halaman Uji'))!
    const a = await repo.createPoster(image('A', { points: ['satu', 'dua'], price: 'Rp 1', category: 'promo' }), adminId, [page.id])
    const b = await repo.createPoster(image('B'), adminId, [page.id])
    expect((await repo.pageById(page.id))!.posterIds).toEqual([a.id, b.id])
    expect(await repo.posterById(a.id)).toMatchObject({
      title: 'A',
      points: ['satu', 'dua'],
      price: 'Rp 1',
      category: 'promo',
      updatedBy: adminId,
    })
    expect(a).not.toHaveProperty('terms') // empty optional fields are left out, like before
    // Reorder, and drop unknown or duplicate IDs.
    expect(await repo.setPagePosters(page.id, [b.id, a.id, a.id, 'p-unknown'])).toEqual([b.id, a.id])
    // Taking a poster off every page.
    await repo.replacePoster(a.id, image('A2'), adminId, [])
    expect((await repo.pageById(page.id))!.posterIds).toEqual([b.id])
    expect((await repo.posterById(a.id))!).not.toHaveProperty('points') // the update cleared what it didn't send
  })

  it('archives and restores, keeps page names unique and one general page', async () => {
    const repo = contentRepo(db)
    const p = await repo.createPoster(image('Arsip'), adminId)
    expect(await repo.patchPoster(p.id, { archived: true, archivedFrom: 'published' }, adminId)).toMatchObject({
      archived: true,
      archivedFrom: 'published',
    })
    expect(await repo.patchPoster(p.id, { archived: false, archivedFrom: null, status: 'published' }, adminId)).not.toHaveProperty(
      'archivedFrom',
    )
    expect(await repo.createPage('halaman uji')).toBeNull() // case-insensitive duplicate
    const other = (await repo.createPage('Lain'))!
    expect(await repo.updatePage(other.id, { name: 'HALAMAN UJI' })).toBe('name-taken')
    const first = (await repo.listPages())[0]!
    await repo.setDefaultPage(first.id)
    await repo.setDefaultPage(other.id)
    expect((await repo.listPages()).filter(p => p.isDefault).map(p => p.id)).toEqual([other.id])
  })

  it('registers cards, records writes and counts taps and clicks atomically', async () => {
    const repo = cardsRepo(db)
    const page = (await contentRepo(db).listPages())[0]!
    const created = await repo.create({ count: 3, label: 'Lobi', group: 'PT Uji', pageId: page.id })
    expect(created.map(c => c.label)).toEqual(['Lobi 1', 'Lobi 2', 'Lobi 3'])
    expect(new Set(created.map(c => c.code)).size).toBe(3)
    const code = created[0]!.code
    expect(await repo.recordWrite(code, false, false, adminId)).toMatchObject({ writeStatus: 'gagal' })
    expect(await repo.recordWrite(code, true, true, adminId)).toMatchObject({ writeStatus: 'sudah', locked: true, writtenBy: adminId })
    // A later failed attempt doesn't undo the success.
    expect(await repo.recordWrite(code, false, false, adminId)).toMatchObject({ writeStatus: 'sudah', locked: true })
    // 20 taps at the same time are all counted.
    await Promise.all(Array.from({ length: 20 }, () => repo.countTap('2026-11-13', code, page.id, 'tap')))
    await repo.countTap('2026-11-13', code, page.id, 'bot')
    await Promise.all(Array.from({ length: 5 }, () => repo.countClick('2026-11-13', code, 'p1|wa', 'click')))
    const [row] = await repo.statsBetween('2026-11-13', '2026-11-13')
    expect(row).toMatchObject({ card: code, taps: 20, bots: 1, clicks: { 'p1|wa': 5 } })
    expect((await repo.byCode(code))!.lastTap).not.toBeNull()
    await repo.setStatus([code], 'nonaktif')
    expect((await repo.activeCountByPage()).get(page.id)).toBe(2)
  })

  it('stores uploads on disk under a random ID and refuses anything that is not one', async () => {
    const repo = uploadsRepo(db, uploadDir)
    const { id } = await repo.save({ data: new Uint8Array([1, 2, 3]), type: 'image/png', name: 'a.png', userId: adminId })
    expect(id).toMatch(/^f[0-9a-f]{32}$/)
    expect(await readdir(uploadDir)).toEqual([id])
    const file = await repo.read(id)
    expect(file?.type).toBe('image/png')
    expect([...file!.data]).toEqual([1, 2, 3])
    for (const bad of ['../etc/passwd', 'f123', `${id}/..`]) expect(await repo.read(bad)).toBeNull()
    expect(await repo.read(`f${'0'.repeat(32)}`)).toBeNull()
  })
})
