import { TODAY } from '#shared/utils/format'

// Click logger: count the click (no personal data), then redirect.
// Targets come only from Settings, never from the URL, so this can't be used as an open redirect.
export default defineEventHandler(event => {
  const posterId = getRouterParam(event, 'poster') ?? ''
  const button = getRouterParam(event, 'button') ?? ''
  const card = String(getQuery(event).c ?? '').slice(0, 8)
  const s = db.settings
  const targets: Record<string, string> = {
    wa: `https://wa.me/${s.wa}`,
    tel: `tel:${s.phone.replace(/\s/g, '')}`,
    email: `mailto:${s.email}`,
    // The poster's own brochure (one of our uploads) or the default from Settings.
    doc: db.posters.find(p => p.id === posterId)?.brochureUrl || s.brochure,
  }
  const target = targets[button]
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak dikenal.' })

  // Count the click once per visitor, card, poster and button within 30 s; prefetches and bots don't count as clicks.
  const row = db.daily.find(r => r.date === TODAY && r.card === card)
  if (row && db.posters.some(p => p.id === posterId)) {
    const visit = classifyVisit(event, `click|${card}|${posterId}|${button}`)
    if (visit === 'count') row.clicks[`${posterId}|${button}`] = (row.clicks[`${posterId}|${button}`] ?? 0) + 1
    else if (visit === 'bot') row.bots += 1
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, target, 302)
})
