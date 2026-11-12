import { posterState } from '#shared/utils/format'

export default defineEventHandler(event => {
  requireUser(event)
  return db.posters.map(p => ({
    ...p,
    state: posterState(p),
    pages: db.pages.filter(pg => pg.posterIds.includes(p.id)).map(pg => ({ id: pg.id, name: pg.name })),
    updatedByName: db.users.find(u => u.id === p.updatedBy)?.name ?? '',
  }))
})
