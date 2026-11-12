export default defineEventHandler(async event => {
  const me = requireUser(event, 'super')
  const input = await parseBody(event, settingsSchema)
  const changed = (Object.keys(input) as (keyof typeof input)[]).filter(k => db.settings[k] !== input[k])
  Object.assign(db.settings, input)
  if (changed.length) logAudit(me.id, 'Mengubah', 'Pengaturan', 'Pengaturan situs', '', `${changed.length} isian diubah`)
  return db.settings
})
