export default defineEventHandler(async event => {
  await requireUser(event)
  const poster = findPosterOr404(getRouterParam(event, 'id'))
  return { ...poster, pageIds: db.pages.filter(pg => pg.posterIds.includes(poster.id)).map(pg => pg.id) }
})
