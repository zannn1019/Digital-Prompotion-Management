export default defineEventHandler(event => {
  const user = currentUser(event)
  return user ? publicUser(user) : null
})
