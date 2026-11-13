import { addDays } from '#shared/utils/format'

const BUTTON_LABEL: Record<string, string> = { wa: 'WhatsApp', tel: 'Telepon', doc: 'Brosur PDF' }

export default defineEventHandler(async event => {
  await requireUser(event)
  // Real calendar dates, in order, at most MAX_ANALYTICS_DAYS apart: the day loop below stays bounded.
  const { from, to } = parseQuery(event, analyticsQuerySchema)
  const content = await useContent()
  const cardsRepo = await useCardsRepo()
  const [rows, cards, pages, posters] = await Promise.all([
    cardsRepo.statsBetween(from, to),
    cardsRepo.list(),
    content.listPages(),
    content.listPosters(),
  ])
  const cardBy = new Map(cards.map(c => [c.code, c]))
  const pageName = new Map(pages.map(p => [p.id, p.name]))
  const posterName = new Map(posters.map(p => [p.id, p.name]))

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

  for (const r of rows) {
    const c = Object.values(r.clicks).reduce((a, b) => a + b, 0)
    taps += r.taps
    clicks += c
    bots += r.bots
    days[r.date]!.taps += r.taps
    days[r.date]!.clicks += c
    byCard[r.card] = (byCard[r.card] ?? 0) + r.taps
    clicksByCard[r.card] = (clicksByCard[r.card] ?? 0) + c
    const card = cardBy.get(r.card)
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
    cardsActive: cards.filter(c => c.status === 'aktif').length,
    days: Object.entries(days).map(([date, v]) => ({ date, ...v })),
    byGroup: top(byGroup, k => k),
    byPage: top(byPage, k => pageName.get(k) ?? k),
    byButton: top(byButton, k => {
      const [pid, btn] = k.split('|')
      return `${posterName.get(pid!) ?? pid} · ${BUTTON_LABEL[btn!] ?? btn}`
    }),
    byCard: Object.entries(byCard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, value]) => {
        const card = cardBy.get(code)
        return {
          code,
          label: card?.label ?? '',
          group: card?.group ?? '',
          page: (card?.pageId && pageName.get(card.pageId)) || 'Halaman umum',
          taps: value,
          clicks: clicksByCard[code] ?? 0,
        }
      }),
  }
})
