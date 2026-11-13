export default defineEventHandler(async event => {
  await requireUser(event)
  const names = await (await useUsers()).names()
  // The address written onto the cards: the configured site (NUXT_PUBLIC_SITE_URL), see server/utils/cardLink.ts.
  const base = cardBaseUrl(useRuntimeConfig(event).public.siteUrl, import.meta.dev, () => getRequestURL(event).origin, db.settings.baseUrl)
  return db.cards.map(c => ({
    ...c,
    pageName: db.pages.find(p => p.id === c.pageId)?.name ?? null,
    writtenByName: (c.writtenBy && names.get(c.writtenBy)) || null,
    url: base + c.code,
  }))
})
