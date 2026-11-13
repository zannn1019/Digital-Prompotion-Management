export default defineEventHandler(async event => {
  await requireUser(event, 'super')
  const names = await (await useUsers()).names()
  return db.audit.map(a => ({ ...a, userName: names.get(a.userId) ?? '' }))
})
