export default defineEventHandler(event => {
  requireUser(event)
  // The address written onto the cards: the configured site (NUXT_PUBLIC_SITE_URL), see server/utils/cardLink.ts.
  const base = cardBaseUrl(useRuntimeConfig(event).public.siteUrl, import.meta.dev, () => getRequestURL(event).origin, db.settings.baseUrl)
  return db.cards.map(c => ({
    ...c,
    pageName: db.pages.find(p => p.id === c.pageId)?.name ?? null,
    writtenByName: db.users.find(u => u.id === c.writtenBy)?.name ?? null,
    url: base + c.code,
  }))
})
