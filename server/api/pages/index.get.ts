export default defineEventHandler(event => {
  requireUser(event)
  return db.pages.map(pg => ({
    ...pg,
    cardCount: db.cards.filter(c => c.pageId === pg.id && c.status === 'aktif').length,
  }))
})
