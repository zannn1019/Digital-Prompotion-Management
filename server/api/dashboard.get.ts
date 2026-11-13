import type { DailyRow } from '#shared/types'
import { addDays, daysBetween, posterState, today } from '#shared/utils/format'

function sum(rows: DailyRow[], from: string, to: string) {
  let taps = 0
  let clicks = 0
  for (const r of rows) {
    if (r.date < from || r.date > to) continue
    taps += r.taps
    clicks += Object.values(r.clicks).reduce((a, b) => a + b, 0)
  }
  return { taps, clicks }
}

export default defineEventHandler(async event => {
  await requireUser(event)
  const day = today()
  const content = await useContent()
  const cardsRepo = await useCardsRepo()
  const [stats, posters, pagesOf, cards, activity, names] = await Promise.all([
    cardsRepo.statsBetween(addDays(day, -13), day),
    content.listPosters(),
    content.pagesOfPosters(),
    cardsRepo.list(),
    (await useAudit()).recentChanges(5),
    (await useUsers()).names(),
  ])
  const cur = sum(stats, addDays(day, -6), day)
  const prev = sum(stats, addDays(day, -13), addDays(day, -7))
  const days = Array.from({ length: 14 }, (_, i) => addDays(day, i - 13)).map(date => ({ date, ...sum(stats, date, date) }))
  const active = posters.filter(p => posterState(p, day) === 'tayang')
  const expiring = active
    .filter(p => {
      const n = daysBetween(day, p.end)
      return n >= 0 && n <= 7
    })
    .sort((a, b) => a.end.localeCompare(b.end))
    .map(p => ({ ...p, pageCount: (pagesOf.get(p.id) ?? []).length }))
  return {
    taps: cur.taps,
    tapsPrev: prev.taps,
    clicks: cur.clicks,
    clicksPrev: prev.clicks,
    cardsActive: cards.filter(c => c.status === 'aktif').length,
    cardsTotal: cards.length,
    cardsUnwritten: cards.filter(c => c.writeStatus !== 'sudah').length,
    postersLive: active.length,
    postersScheduled: posters.filter(p => posterState(p, day) === 'terjadwal').length,
    postersDraft: posters.filter(p => posterState(p, day) === 'draft').length,
    expiring,
    days,
    // Content changes only: sign-ins and failed sign-ins stay in the Audit Log.
    activity: activity.map(a => ({ ...a, userName: names.get(a.userId) ?? '' })),
  }
})
