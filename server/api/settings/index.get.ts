export default defineEventHandler(event => {
  requireUser(event)
  return db.settings
})
