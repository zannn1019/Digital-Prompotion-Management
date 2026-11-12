export default defineEventHandler(event => {
  requireUser(event, 'super')
  return db.audit.map(a => ({ ...a, userName: db.users.find(u => u.id === a.userId)?.name ?? '' }))
})
