import { addDays } from '#shared/utils/format'

const BUTTON_LABEL: Record<string, string> = { wa: 'WhatsApp', tel: 'Telepon', doc: 'Brosur PDF' }

export default defineEventHandler(async event => {
  await requireUser(event)
  // Real calendar dates, in order, at most MAX_ANALYTICS_DAYS apart: the day loop below stays bounded.
  const { from, to } = parseQuery(event, analyticsQuerySchema)

  const days: Record<string, { taps: number; clicks: number }> = {}
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = { taps: 0, clicks: 0 }
  const byCard: Record<string, number> = {}
  const byGroup: Record<string, number> = {}
  const byPage: Record<string, number> = {}
  const byButton: Record<string, number> = {}
  const clicksByCard: Record<string, number> = {}
  let taps = 0,
    clicks = 0,
    bots = 0

  for (const r of db.daily) {
    if (r.date < from || r.date > to) continue
    const c = Object.values(r.clicks).reduce((a, b) => a + b, 0)
    taps += r.taps
    clicks += c
    bots += r.bots
    days[r.date]!.taps += r.taps
    days[r.date]!.clicks += c
    byCard[r.card] = (byCard[r.card] ?? 0) + r.taps
    clicksByCard[r.card] = (clicksByCard[r.card] ?? 0) + c
    const card = db.cards.find(x => x.code === r.card)
    if (card) byGroup[card.group] = (byGroup[card.group] ?? 0) + r.taps
    byPage[r.pageId] = (byPage[r.pageId] ?? 0) + r.taps
    for (const [k, n] of Object.entries(r.clicks)) byButton[k] = (byButton[k] ?? 0) + n
  }

  const top = (o: Record<string, number>, label: (k: string) => string, n = 5) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => ({ label: label(k), value: v }))

  return {
    from,
    to,
    taps,
    clicks,
    bots,
    cardsTapped: Object.keys(byCard).length,
    cardsActive: db.cards.filter(c => c.status === 'aktif').length,
    days: Object.entries(days).map(([date, v]) => ({ date, ...v })),
    byGroup: top(byGroup, k => k),
    byPage: top(byPage, k => db.pages.find(p => p.id === k)?.name ?? k),
    byButton: top(byButton, k => {
      const [pid, btn] = k.split('|')
      return `${db.posters.find(p => p.id === pid)?.name ?? pid} · ${BUTTON_LABEL[btn!] ?? btn}`
    }),
    byCard: Object.entries(byCard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, value]) => {
        const card = db.cards.find(c => c.code === code)
        return {
          code,
          label: card?.label ?? '',
          group: card?.group ?? '',
          page: db.pages.find(p => p.id === card?.pageId)?.name ?? 'Halaman umum',
          taps: value,
          clicks: clicksByCard[code] ?? 0,
        }
      }),
  }
})
