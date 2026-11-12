// Demo video studio only: signs the browser in as the seeded Super Admin so /video can render
// the real admin pages with demo data. Refused unless the studio is switched on in dev.
export default defineEventHandler(event => {
  if (!import.meta.dev || !useRuntimeConfig(event).public.videoStudio) throw createError({ statusCode: 404 })
  createSession(event, 'u1')
  return { ok: true }
})
