export default defineEventHandler(async event => {
  await requireUser(event, 'super')
  const names = await (await useUsers()).names()
  return (await (await useAudit()).list()).map(a => ({ ...a, userName: names.get(a.userId) ?? '' }))
})
