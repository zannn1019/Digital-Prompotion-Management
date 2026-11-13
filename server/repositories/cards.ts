// NFC cards and their daily tap/click counts in PostgreSQL. Plain TypeScript on Drizzle (no Nuxt imports).
import { randomInt } from 'node:crypto'
import { and, between, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Card, DailyRow } from '#shared/types'
import type { Database } from '../db/client'
import { cards, dailyStats } from '../db/schema'
import { toStamp } from '../db/time'

// Unambiguous characters only (no 0/O, 1/I). 32^8 ≈ 10^12 codes: not guessable.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function randomCardCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

type CardRow = typeof cards.$inferSelect
const toCard = (r: CardRow): Card => ({
  code: r.code,
  label: r.label,
  group: r.group,
  pageId: r.pageId,
  status: r.status,
  writeStatus: r.writeStatus,
  writtenAt: toStamp(r.writtenAt),
  writtenBy: r.writtenBy,
  locked: r.locked,
  lastTap: toStamp(r.lastTap),
})

export function cardsRepo(db: Database) {
  return {
    /** All cards, newest first. */
    async list(): Promise<Card[]> {
      return (await db.select().from(cards).orderBy(desc(cards.createdAt), desc(cards.code))).map(toCard)
    },

    async byCode(code: string): Promise<Card | null> {
      const [r] = await db.select().from(cards).where(eq(cards.code, code))
      return r ? toCard(r) : null
    },

    async byCodes(codes: string[]): Promise<Card[]> {
      if (!codes.length) return []
      return (await db.select().from(cards).where(inArray(cards.code, codes))).map(toCard)
    },

    /** Registers `count` cards with fresh random codes ("Label 1", "Label 2", … when more than one). */
    async create(input: { count: number; label: string; group: string; pageId: string | null }): Promise<Card[]> {
      const created: Card[] = []
      for (let i = 0; i < input.count; i++) {
        // A clash with an existing code is astronomically rare; try again if it happens.
        for (let attempt = 0; attempt < 5; attempt++) {
          const [r] = await db
            .insert(cards)
            .values({
              code: randomCardCode(),
              label: input.count > 1 ? `${input.label} ${i + 1}` : input.label,
              group: input.group,
              pageId: input.pageId,
            })
            .onConflictDoNothing()
            .returning()
          if (r) {
            created.push(toCard(r))
            break
          }
        }
      }
      return created
    },

    async mapToPage(codes: string[], pageId: string | null): Promise<void> {
      await db.update(cards).set({ pageId }).where(inArray(cards.code, codes))
    },

    async setStatus(codes: string[], status: Card['status']): Promise<void> {
      await db.update(cards).set({ status }).where(inArray(cards.code, codes))
    },

    /** Records a write attempt from the phone writer. A failed attempt never undoes an earlier success. */
    async recordWrite(code: string, ok: boolean, locked: boolean, userId: string): Promise<Card | null> {
      const [r] = await db
        .update(cards)
        .set(
          ok
            ? { writeStatus: 'sudah', writtenAt: new Date(), writtenBy: userId, locked: sql`${cards.locked} or ${locked}` }
            : { writeStatus: sql`case when ${cards.writeStatus} = 'sudah' then 'sudah'::write_status else 'gagal'::write_status end` },
        )
        .where(eq(cards.code, code))
        .returning()
      return r ? toCard(r) : null
    },

    /** Active cards per page. */
    async activeCountByPage(): Promise<Map<string, number>> {
      const rows = await db
        .select({ pageId: cards.pageId, n: sql<number>`count(*)::int` })
        .from(cards)
        .where(eq(cards.status, 'aktif'))
        .groupBy(cards.pageId)
      return new Map(rows.filter(r => r.pageId).map(r => [r.pageId!, r.n]))
    },

    // ---- Daily counts ----

    /** One tap (or one bot visit) for a card on a day. Atomic, so simultaneous taps are all counted. */
    async countTap(date: string, code: string, pageId: string, kind: 'tap' | 'bot'): Promise<void> {
      const col = kind === 'tap' ? dailyStats.taps : dailyStats.bots
      await db
        .insert(dailyStats)
        .values({ date, cardCode: code, pageId, taps: kind === 'tap' ? 1 : 0, bots: kind === 'bot' ? 1 : 0 })
        .onConflictDoUpdate({
          target: [dailyStats.date, dailyStats.cardCode],
          set: { [kind === 'tap' ? 'taps' : 'bots']: sql`${col} + 1` },
        })
      if (kind === 'tap') await db.update(cards).set({ lastTap: new Date() }).where(eq(cards.code, code))
    },

    /** One contact-button click (`posterId|button`). Only counted for a card already tapped that day. */
    async countClick(date: string, code: string, key: string, kind: 'click' | 'bot'): Promise<void> {
      await db
        .update(dailyStats)
        .set(
          kind === 'bot'
            ? { bots: sql`${dailyStats.bots} + 1` }
            : {
                clicks: sql`jsonb_set(${dailyStats.clicks}, ARRAY[${key}], to_jsonb(coalesce((${dailyStats.clicks}->>${key})::int, 0) + 1))`,
              },
        )
        .where(and(eq(dailyStats.date, date), eq(dailyStats.cardCode, code)))
    },

    async statsBetween(from: string, to: string): Promise<DailyRow[]> {
      const rows = await db
        .select()
        .from(dailyStats)
        .where(between(dailyStats.date, from, to))
      return rows.map(r => ({ date: r.date, card: r.cardCode, pageId: r.pageId ?? '', taps: r.taps, bots: r.bots, clicks: r.clicks }))
    },
  }
}

export type CardsRepo = ReturnType<typeof cardsRepo>
