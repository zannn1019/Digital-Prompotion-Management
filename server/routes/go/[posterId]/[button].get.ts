import { today } from '#shared/utils/format'

// Click logger: count the click (no personal data), then redirect.
// Targets come only from Settings, never from the URL, so this can't be used as an open redirect.
export default defineEventHandler(async event => {
  const posterId = getRouterParam(event, 'posterId') ?? ''
  const button = getRouterParam(event, 'button') ?? ''
  const card = String(getQuery(event).c ?? '')
    .slice(0, 8)
    .toUpperCase()
  const s = await (await useSettingsRepo()).get()
  const poster = await (await useContent()).posterById(posterId)
  const targets: Record<string, string> = {
    wa: `https://wa.me/${s.wa}`,
    tel: `tel:${s.phone.replace(/\s/g, '')}`,
    email: `mailto:${s.email}`,
    // The poster's own brochure (one of our uploads) or the default from Settings.
    doc: poster?.brochureUrl || s.brochure,
  }
  const target = targets[button]
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Tautan tidak dikenal.' })

  // Count the click once per visitor, card, poster and button within 30 s; prefetches don't count, bots go to `bots`.
  // Only for a real poster and a card tapped today (the tap created today's row).
  if (poster && /^[A-Z0-9]{8}$/.test(card)) {
    const visit = classifyVisit(event, `click|${card}|${posterId}|${button}`)
    if (visit === 'count' || visit === 'bot')
      await (await useCardsRepo()).countClick(today(), card, `${posterId}|${button}`, visit === 'count' ? 'click' : 'bot')
  }
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, target, 302)
})
