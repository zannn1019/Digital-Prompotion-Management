export default defineEventHandler(async event => {
  const me = await requireUser(event, 'super')
  const input = await parseBody(event, settingsSchema)
  const { settings, changed } = await (await useSettingsRepo()).update(input)
  if (changed.length) await logAudit(me.id, 'Mengubah', 'Pengaturan', 'Pengaturan situs', '', `${changed.length} isian diubah`)
  return settings
})
