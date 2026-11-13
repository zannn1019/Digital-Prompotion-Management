// Posters, announcements and pages in PostgreSQL. Plain TypeScript on Drizzle (no Nuxt imports).
import { and, asc, desc, eq, inArray, max, or, sql } from 'drizzle-orm'
import type { Page, Poster, Theme, PublishStatus } from '#shared/types'
import type { Database } from '../db/client'
import { pagePosters, pages, posters } from '../db/schema'
import { toStamp } from '../db/time'
import { isUniqueViolation, newId } from './ids'

type PosterRow = typeof posters.$inferSelect
type PosterInsert = typeof posters.$inferInsert
/** The fields a create or update may set (id, timestamps and author are filled in here). */
export type PosterFields = Omit<Poster, 'id' | 'updatedAt' | 'updatedBy' | 'archived'> & { archived?: boolean }

/** Row → API shape: empty optional fields are left out, like the API always did. */
function toPoster(r: PosterRow): Poster {
  const p: Record<string, unknown> = {
    id: r.id,
    kind: r.kind,
    name: r.name,
    status: r.status,
    archived: r.archived,
    start: r.start,
    end: r.end,
    updatedAt: toStamp(r.updatedAt) ?? '',
    updatedBy: r.updatedBy ?? '',
  }
  const optional = {
    archivedFrom: r.archivedFrom,
    imageUrl: r.imageUrl,
    imageFile: r.imageFile,
    imageSize: r.imageSize,
    description: r.description,
    buttons: r.buttons,
    title: r.title,
    category: r.category,
    price: r.price,
    priceUnit: r.priceUnit,
    listTitle: r.listTitle,
    points: r.points,
    terms: r.terms,
    brochureUrl: r.brochureUrl,
    brochureFile: r.brochureFile,
    design: r.design,
    text: r.text,
    level: r.level,
  }
  for (const [k, v] of Object.entries(optional)) if (v !== null && v !== undefined) p[k] = v
  return p as unknown as Poster
}

/** API fields → columns. Optional fields missing from `f` are cleared (an update sends the whole poster). */
function toRow(f: PosterFields): Omit<PosterInsert, 'id' | 'updatedBy'> {
  return {
    kind: f.kind,
    name: f.name,
    status: f.status,
    start: f.start,
    end: f.end,
    imageUrl: f.imageUrl ?? null,
    imageFile: f.imageFile ?? null,
    imageSize: f.imageSize ?? null,
    description: f.description ?? null,
    buttons: f.buttons ?? null,
    title: f.title ?? null,
    category: f.category ?? null,
    price: f.price ?? null,
    priceUnit: f.priceUnit ?? null,
    listTitle: f.listTitle ?? null,
    points: f.points ?? null,
    terms: f.terms ?? null,
    brochureUrl: f.brochureUrl ?? null,
    brochureFile: f.brochureFile ?? null,
    design: f.design ?? null,
    text: f.text ?? null,
    level: f.level ?? null,
  }
}

type PageRow = typeof pages.$inferSelect
const toPage = (r: PageRow, posterIds: string[]): Page => ({
  id: r.id,
  name: r.name,
  theme: r.theme,
  status: r.status,
  isDefault: r.isDefault,
  posterIds,
  updatedAt: toStamp(r.updatedAt) ?? '',
})

export function contentRepo(db: Database) {
  /** posterIds per page, in their order. */
  async function placements(pageIds?: string[]): Promise<Map<string, string[]>> {
    const rows = await db
      .select()
      .from(pagePosters)
      .where(pageIds ? inArray(pagePosters.pageId, pageIds) : undefined)
      .orderBy(asc(pagePosters.pageId), asc(pagePosters.position))
    const out = new Map<string, string[]>()
    for (const r of rows) out.set(r.pageId, [...(out.get(r.pageId) ?? []), r.posterId])
    return out
  }

  return {
    // ---- Posters ----

    /** All posters and announcements, newest first. */
    async listPosters(): Promise<Poster[]> {
      return (await db.select().from(posters).orderBy(desc(posters.createdAt))).map(toPoster)
    },

    async posterById(id: string): Promise<Poster | null> {
      const [r] = await db.select().from(posters).where(eq(posters.id, id))
      return r ? toPoster(r) : null
    },

    /** Posters that show this file as their image or brochure. */
    async postersUsingFile(url: string): Promise<Poster[]> {
      return (
        await db
          .select()
          .from(posters)
          .where(or(eq(posters.imageUrl, url), eq(posters.brochureUrl, url)))
      ).map(toPoster)
    },

    async postersByIds(ids: string[]): Promise<Poster[]> {
      if (!ids.length) return []
      return (await db.select().from(posters).where(inArray(posters.id, ids))).map(toPoster)
    },

    async createPoster(f: PosterFields, userId: string, pageIds?: string[]): Promise<Poster> {
      const id = newId(f.kind === 'pengumuman' ? 'a' : 'p')
      return db.transaction(async tx => {
        const [r] = await tx
          .insert(posters)
          .values({ ...toRow(f), id, archived: f.archived ?? false, updatedBy: userId })
          .returning()
        if (pageIds) await placeIn(tx as unknown as Database, id, pageIds)
        return toPoster(r!)
      })
    },

    /** Replaces the poster's fields (the edit form sends all of them). */
    async replacePoster(id: string, f: PosterFields, userId: string, pageIds?: string[]): Promise<Poster | null> {
      return db.transaction(async tx => {
        const [r] = await tx
          .update(posters)
          .set({ ...toRow(f), updatedAt: new Date(), updatedBy: userId })
          .where(eq(posters.id, id))
          .returning()
        if (r && pageIds) await placeIn(tx as unknown as Database, id, pageIds)
        return r ? toPoster(r) : null
      })
    },

    /** Changes a few fields (archive, extend). */
    async patchPoster(
      id: string,
      patch: Partial<{ status: PublishStatus; archived: boolean; archivedFrom: PublishStatus | null; end: string }>,
      userId: string,
    ): Promise<Poster | null> {
      const [r] = await db
        .update(posters)
        .set({ ...patch, updatedAt: new Date(), updatedBy: userId })
        .where(eq(posters.id, id))
        .returning()
      return r ? toPoster(r) : null
    },

    /** Page IDs per poster, and page names, for the poster list. */
    async pagesOfPosters(): Promise<Map<string, { id: string; name: string }[]>> {
      const rows = await db
        .select({ posterId: pagePosters.posterId, id: pages.id, name: pages.name })
        .from(pagePosters)
        .innerJoin(pages, eq(pages.id, pagePosters.pageId))
        .orderBy(asc(pages.createdAt))
      const out = new Map<string, { id: string; name: string }[]>()
      for (const r of rows) out.set(r.posterId, [...(out.get(r.posterId) ?? []), { id: r.id, name: r.name }])
      return out
    },

    // ---- Pages ----

    async listPages(): Promise<Page[]> {
      const rows = await db.select().from(pages).orderBy(asc(pages.createdAt))
      const placed = await placements()
      return rows.map(r => toPage(r, placed.get(r.id) ?? []))
    },

    async pageById(id: string): Promise<Page | null> {
      const [r] = await db.select().from(pages).where(eq(pages.id, id))
      return r ? toPage(r, (await placements([id])).get(id) ?? []) : null
    },

    /** The general page for unmapped and inactive cards, if one is set. */
    async defaultPage(): Promise<Page | null> {
      const [r] = await db.select().from(pages).where(eq(pages.isDefault, true))
      return r ? toPage(r, (await placements([r.id])).get(r.id) ?? []) : null
    },

    /** New, empty, draft page. Null when the name is taken (case-insensitive). */
    async createPage(name: string): Promise<Page | null> {
      try {
        const [r] = await db
          .insert(pages)
          .values({ id: newId('pg'), name })
          .returning()
        return toPage(r!, [])
      } catch (e) {
        if (isUniqueViolation(e)) return null
        throw e
      }
    },

    /** Renames, re-themes or (un)publishes. Returns 'name-taken' when the new name is in use. */
    async updatePage(id: string, patch: Partial<{ name: string; theme: Theme; status: PublishStatus }>): Promise<'ok' | 'name-taken'> {
      try {
        await db
          .update(pages)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(pages.id, id))
        return 'ok'
      } catch (e) {
        if (isUniqueViolation(e)) return 'name-taken'
        throw e
      }
    },

    /** Sets the page's posters in this order. Only existing image posters are kept; duplicates are dropped. */
    async setPagePosters(pageId: string, posterIds: string[]): Promise<string[]> {
      const unique = [...new Set(posterIds)]
      return db.transaction(async tx => {
        const valid = unique.length
          ? new Set(
              (
                await tx
                  .select({ id: posters.id })
                  .from(posters)
                  .where(and(inArray(posters.id, unique), eq(posters.kind, 'gambar')))
              ).map(r => r.id),
            )
          : new Set<string>()
        const kept = unique.filter(id => valid.has(id))
        await tx.delete(pagePosters).where(eq(pagePosters.pageId, pageId))
        if (kept.length) await tx.insert(pagePosters).values(kept.map((posterId, position) => ({ pageId, posterId, position })))
        await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, pageId))
        return kept
      })
    },

    /** Makes this page the only general page. */
    async setDefaultPage(pageId: string): Promise<void> {
      await db.transaction(async tx => {
        await tx.update(pages).set({ isDefault: false }).where(eq(pages.isDefault, true))
        await tx.update(pages).set({ isDefault: true, updatedAt: new Date() }).where(eq(pages.id, pageId))
      })
    },
  }
}

/** Puts a poster on exactly the given pages; it is appended at the end of pages it newly joins. */
async function placeIn(db: Database, posterId: string, pageIds: string[]) {
  const existing = await db.select().from(pagePosters).where(eq(pagePosters.posterId, posterId))
  const has = new Set(existing.map(r => r.pageId))
  const want = new Set(pageIds)
  const remove = [...has].filter(id => !want.has(id))
  if (remove.length) await db.delete(pagePosters).where(and(eq(pagePosters.posterId, posterId), inArray(pagePosters.pageId, remove)))
  const valid = new Set(
    (
      await db
        .select({ id: pages.id })
        .from(pages)
        .where(inArray(pages.id, [...want].length ? [...want] : ['']))
    ).map(r => r.id),
  )
  for (const pageId of [...want].filter(id => !has.has(id) && valid.has(id))) {
    const [{ m } = { m: null }] = await db
      .select({ m: max(pagePosters.position) })
      .from(pagePosters)
      .where(eq(pagePosters.pageId, pageId))
    await db.insert(pagePosters).values({ pageId, posterId, position: (m ?? -1) + 1 })
  }
  if (remove.length || want.size)
    await db
      .update(pages)
      .set({ updatedAt: sql`now()` })
      .where(inArray(pages.id, [...new Set([...remove, ...want])]))
}

export type ContentRepo = ReturnType<typeof contentRepo>
