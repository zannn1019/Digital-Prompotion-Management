export default defineEventHandler(async event => {
  const user = await currentUser(event)
  return user ? publicUser(user) : null
})
