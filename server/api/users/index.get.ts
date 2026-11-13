export default defineEventHandler(async event => {
  await requireUser(event, 'super')
  return (await (await useUsers()).list()).map(publicUser)
})
