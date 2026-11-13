import type { Poster } from '#shared/types'
import { fmtRange } from '#shared/utils/format'

const describe = (p: Poster) => (p.status === 'published' ? `Terbit · ${fmtRange(p.start, p.end)}` : 'Draft')

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const input = await parseBody(event, poster.kind === 'pengumuman' ? announcementSchema : imagePosterSchema)

  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  // Only schema-checked fields are saved; id, kind and archive state never change here.
  // An editor design or brochure sent as null is cleared (a plain uploaded file replaces a design).
  const updated = await (
    await useContent()
  ).replacePoster(
    poster.id,
    { ...fields, kind: poster.kind, name: fields.name || poster.name, archivedFrom: poster.archivedFrom },
    user.id,
    poster.kind === 'gambar' ? pageIds : undefined,
  )
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Poster tidak ditemukan.' })
  await logAudit(
    user.id,
    'Mengubah',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    updated.name,
    describe(poster),
    describe(updated),
  )
  return updated
})
