export default defineEventHandler(async event => {
  await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const pages = (await (await useContent()).pagesOfPosters()).get(poster.id) ?? []
  return { ...poster, pageIds: pages.map(p => p.id) }
})
