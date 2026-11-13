export default defineEventHandler(async event => {
  await requireUser(event)
  return (await useSettingsRepo()).get()
})
