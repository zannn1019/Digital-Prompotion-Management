import { posterState } from '#shared/utils/format'

export default defineEventHandler(async event => {
  await requireUser(event)
  const names = await (await useUsers()).names()
  return db.posters.map(p => ({
    ...p,
    state: posterState(p),
    pages: db.pages.filter(pg => pg.posterIds.includes(p.id)).map(pg => ({ id: pg.id, name: pg.name })),
    updatedByName: names.get(p.updatedBy) ?? '',
  }))
})
