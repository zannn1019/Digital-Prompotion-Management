import { posterState } from '#shared/utils/format'

/** A file visitors may see: the image or brochure of a live poster, or the site logo. */
async function isPublic(url: string) {
  if ((await (await useSettingsRepo()).get()).logoUrl === url) return true
  return (await (await useContent()).postersUsingFile(url)).some(p => posterState(p) === 'tayang')
}

// Signed-in staff can open every upload (drafts, previews). Visitors only get files that are live,
// so draft posters and brochures stay private until they are published.
export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id') ?? ''
  const file = await (await useUploads()).read(id)
  const viewer = file ? await currentUser(event) : null
  // Someone who still has a temporary password sees only what visitors see.
  const visible = file && ((viewer && !viewer.mustChangePassword) || (await isPublic(`/api/uploads/${id}`)))
  // Same answer for "missing" and "not public yet".
  if (!file || !visible) throw createError({ statusCode: 404, statusMessage: 'File tidak ditemukan.' })
  setResponseHeaders(event, {
    'Content-Type': file.type,
    // PDFs (brochures) download instead of rendering on our origin.
    'Content-Disposition': file.type === 'application/pdf' ? 'attachment; filename="brosur.pdf"' : 'inline',
    // A file can stop being public (poster unpublished, archived), so shared caches keep it only briefly.
    'Cache-Control': 'private, max-age=3600',
  })
  return file.data
})
