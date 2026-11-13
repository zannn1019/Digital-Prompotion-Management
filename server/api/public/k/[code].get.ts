import type { Page, Poster, PublicPoster, PublicView } from '#shared/types'
import { PUBLIC_POSTER_FIELDS } from '#shared/types'
import { posterState, today } from '#shared/utils/format'

/** Copies only the fields visitors need (allow-list): no internal name, author, file name or editor data. */
function toPublicPoster(p: Poster): PublicPoster {
  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_POSTER_FIELDS) if (p[key] !== undefined) out[key] = p[key]
  return out as PublicPoster
}

// Resolves what a phone sees after tapping a card. No login, no cookies.
// Inactive/unmapped cards and unknown codes reveal nothing about why.
export default defineEventHandler(async event => {
  const code = (getRouterParam(event, 'code') ?? '').toUpperCase()
  const day = today()
  const content = await useContent()
  const cardsRepo = await useCardsRepo()
  // Only well-formed codes are looked up.
  const card = /^[A-Z0-9]{8}$/.test(code) ? await cardsRepo.byCode(code) : null

  let kind: PublicView['kind'] = 'page'
  let page: Page | null = null
  if (!card) kind = 'notfound'
  else {
    const mapped = card.pageId ? await content.pageById(card.pageId) : null
    if (card.status !== 'aktif' || !mapped || mapped.status !== 'published') kind = 'fallback'
    else {
      page = mapped
      // Count the tap once per visitor and card within 30 s; prefetches don't count, preview bots go to `bots`.
      const visit = classifyVisit(event, `tap|${card.code}`)
      if (visit === 'count' || visit === 'bot') await cardsRepo.countTap(day, card.code, page.id, visit === 'count' ? 'tap' : 'bot')
    }
  }

  const [pagePosters, all, settings] = await Promise.all([
    page ? content.postersByIds(page.posterIds) : Promise.resolve([]),
    content.listPosters(),
    (await useSettingsRepo()).get(),
  ])
  // In the page's own order, live ones only.
  const byId = new Map(pagePosters.map(p => [p.id, p]))
  const posters = (page?.posterIds ?? []).map(id => byId.get(id)).filter((p): p is Poster => !!p && posterState(p, day) === 'tayang')
  const { company, tagline, logoUrl, address, wa, phone, email, hours, website, brochure } = settings
  const view: PublicView = {
    kind,
    posters: kind === 'page' ? posters.map(toPublicPoster) : [],
    announcements: all.filter(p => p.kind === 'pengumuman' && posterState(p, day) === 'tayang').map(toPublicPoster),
    settings: { company, tagline, logoUrl, address, wa, phone, email, hours, website, brochure },
  }
  // The page sets the HTTP 404 itself, so the response stays a normal 200 here.
  return view
})
