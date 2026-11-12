import { TODAY, addDays, daysBetween, posterState } from '#shared/utils/format'

function sumRange(from: string, to: string) {
  let taps = 0
  let clicks = 0
  for (const r of db.daily) {
    if (r.date < from || r.date > to) continue
    taps += r.taps
    clicks += Object.values(r.clicks).reduce((a, b) => a + b, 0)
  }
  return { taps, clicks }
}

export default defineEventHandler(event => {
  requireUser(event)
  const cur = sumRange(addDays(TODAY, -6), TODAY)
  const prev = sumRange(addDays(TODAY, -13), addDays(TODAY, -7))
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 13)).map(date => {
    const r = sumRange(date, date)
    return { date, ...r }
  })
  const active = db.posters.filter(p => posterState(p) === 'tayang')
  const expiring = active
    .filter(p => {
      const n = daysBetween(TODAY, p.end)
      return n >= 0 && n <= 7
    })
    .sort((a, b) => a.end.localeCompare(b.end))
    .map(p => ({ ...p, pageCount: db.pages.filter(pg => pg.posterIds.includes(p.id)).length }))
  return {
    taps: cur.taps,
    tapsPrev: prev.taps,
    clicks: cur.clicks,
    clicksPrev: prev.clicks,
    cardsActive: db.cards.filter(c => c.status === 'aktif').length,
    cardsTotal: db.cards.length,
    cardsUnwritten: db.cards.filter(c => c.writeStatus !== 'sudah').length,
    postersLive: active.length,
    postersScheduled: db.posters.filter(p => posterState(p) === 'terjadwal').length,
    postersDraft: db.posters.filter(p => posterState(p) === 'draft').length,
    expiring,
    days,
    // Content changes only: sign-ins and failed sign-ins stay in the Audit Log.
    activity: db.audit
      .filter(a => a.entity !== 'Sesi')
      .slice(0, 5)
      .map(a => ({ ...a, userName: db.users.find(u => u.id === a.userId)?.name ?? '' })),
  }
})
