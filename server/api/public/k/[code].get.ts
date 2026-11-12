import type { Page, Poster, PublicPoster, PublicView } from '#shared/types'
import { PUBLIC_POSTER_FIELDS } from '#shared/types'
import { posterState } from '#shared/utils/format'

/** Copies only the fields visitors need (allow-list): no internal name, author, file name or editor data. */
function toPublicPoster(p: Poster): PublicPoster {
  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_POSTER_FIELDS) if (p[key] !== undefined) out[key] = p[key]
  return out as PublicPoster
}

// Resolves what a phone sees after tapping a card. No login, no cookies.
// Inactive/unmapped cards and unknown codes reveal nothing about why.
export default defineEventHandler((event) => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  // Only well-formed codes are looked up.
  const card = /^[A-Z0-9]{8}$/.test(code) ? db.cards.find(c => c.code === code) : undefined
  const fallback = db.pages.find(p => p.isDefault) ?? db.pages[0]!

  let kind: PublicView['kind'] = 'page'
  let page: Page = fallback
  if (!card) kind = 'notfound'
  else {
    const mapped = db.pages.find(p => p.id === card.pageId)
    if (card.status !== 'aktif' || !mapped || mapped.status !== 'published') kind = 'fallback'
    else {
      page = mapped
      // Count the tap once per visitor and card within 30 s; prefetches don't count, preview bots go to `bots`.
      const visit = classifyVisit(event, `tap|${card.code}`)
      if (visit === 'count') {
        todayRow(card.code, page.id).taps += 1
        card.lastTap = `${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
      } else if (visit === 'bot') todayRow(card.code, page.id).bots += 1
    }
  }

  const live = (id: string) => {
    const poster = db.posters.find(p => p.id === id && posterState(p) === 'tayang')
    return poster && toPublicPoster(poster)
  }
  const { company, tagline, logoUrl, address, wa, phone, email, hours, website, brochure } = db.settings
  const view: PublicView = {
    kind,
    posters: kind === 'page' ? page.posterIds.map(live).filter(p => !!p) : [],
    announcements: db.posters.filter(p => p.kind === 'pengumuman' && posterState(p) === 'tayang').map(toPublicPoster),
    settings: { company, tagline, logoUrl, address, wa, phone, email, hours, website, brochure },
  }
  // The page sets the HTTP 404 itself, so the response stays a normal 200 here.
  return view
})
