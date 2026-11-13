import { posterState } from '#shared/utils/format'

export default defineEventHandler(async event => {
  await requireUser(event)
  const content = await useContent()
  const [list, pagesOf, names] = await Promise.all([content.listPosters(), content.pagesOfPosters(), (await useUsers()).names()])
  return list.map(p => ({
    ...p,
    state: posterState(p),
    pages: pagesOf.get(p.id) ?? [],
    updatedByName: names.get(p.updatedBy) ?? '',
  }))
})
