import { posterState } from '#shared/utils/format'

export default defineEventHandler(async event => {
  await requireUser(event)
  const content = await useContent()
  const [list, pagesOf, names] = await Promise.all([
    content.listPosters(),
    content.pagesOfPosters(),
    (await useUsers()).names(),
  ])
  return list.map(p => ({
    ...p,
    state: posterState(p),
    pages: pagesOf.get(p.id) ?? [],
    updatedByName: names.get(p.updatedBy) ?? '',
    ownerName: (p.ownerId && names.get(p.ownerId)) || null,
    pendingByName: (p.pending && names.get(p.pending.by)) || null,
    rejectedByName: (p.rejection && names.get(p.rejection.by)) || null,
  }))
})
