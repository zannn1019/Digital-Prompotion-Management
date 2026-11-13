// Demo video studio only: signs the browser in as the first Super Admin so /video can render
// the real admin pages. Refused unless the studio is switched on in dev.
export default defineEventHandler(async event => {
  if (!import.meta.dev || !useRuntimeConfig(event).public.videoStudio) throw createError({ statusCode: 404 })
  const admin = (await (await useUsers()).list()).find(u => u.role === 'super' && u.status === 'active')
  if (!admin) throw createError({ statusCode: 404 })
  await createSession(event, admin.id)
  return { ok: true }
})
