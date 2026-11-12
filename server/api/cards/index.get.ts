export default defineEventHandler(event => {
  requireUser(event)
  return db.cards.map(c => ({
    ...c,
    pageName: db.pages.find(p => p.id === c.pageId)?.name ?? null,
    writtenByName: db.users.find(u => u.id === c.writtenBy)?.name ?? null,
    url: db.settings.baseUrl + c.code,
  }))
})
