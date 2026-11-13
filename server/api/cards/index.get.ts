export default defineEventHandler(async event => {
  await requireUser(event)
  const [list, pages, names, settings] = await Promise.all([
    (await useCardsRepo()).list(),
    (await useContent()).listPages(),
    (await useUsers()).names(),
    (await useSettingsRepo()).get(),
  ])
  const pageName = new Map(pages.map(p => [p.id, p.name]))
  // The address written onto the cards: the configured site (NUXT_PUBLIC_SITE_URL), see server/utils/cardLink.ts.
  const base = cardBaseUrl(useRuntimeConfig(event).public.siteUrl, import.meta.dev, () => getRequestURL(event).origin, settings.baseUrl)
  return list.map(c => ({
    ...c,
    pageName: (c.pageId && pageName.get(c.pageId)) || null,
    writtenByName: (c.writtenBy && names.get(c.writtenBy)) || null,
    url: base + c.code,
  }))
})
