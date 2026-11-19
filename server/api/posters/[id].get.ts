export default defineEventHandler(async event => {
  await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const [pages, names] = await Promise.all([
    (await useContent()).pagesOfPosters(),
    (await useUsers()).names(),
  ])
  return {
    ...poster,
    pageIds: (pages.get(poster.id) ?? []).map(p => p.id),
    ownerName: (poster.ownerId && names.get(poster.ownerId)) || null,
    pendingByName: (poster.pending && names.get(poster.pending.by)) || null,
    rejectedByName: (poster.rejection && names.get(poster.rejection.by)) || null,
  }
})
