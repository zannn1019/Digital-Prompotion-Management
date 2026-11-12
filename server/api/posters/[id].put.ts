import { fmtRange, nowStamp } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = requireUser(event)
  const poster = findPosterOr404(getRouterParam(event, 'id'))
  const input = await parseBody(event, poster.kind === 'pengumuman' ? announcementSchema : imagePosterSchema)

  const describe = () => (poster.status === 'published' ? `Terbit · ${fmtRange(poster.start, poster.end)}` : 'Draft')
  const before = describe()
  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  // Only schema-checked fields are copied; id, kind and archive state never change here.
  Object.assign(poster, fields, { name: fields.name || poster.name, updatedAt: nowStamp(), updatedBy: user.id })
  // A plain uploaded file replaces an editor design.
  if (poster.design === null) delete poster.design
  if (poster.brochureUrl === null) delete poster.brochureUrl
  if (poster.kind === 'gambar') placePoster(poster.id, pageIds)
  logAudit(user.id, 'Mengubah', poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster', poster.name, before, describe())
  return poster
})
