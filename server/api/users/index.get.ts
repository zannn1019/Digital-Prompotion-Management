export default defineEventHandler(event => {
  requireUser(event, 'super')
  return db.users.map(publicUser)
})
