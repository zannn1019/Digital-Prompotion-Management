import { shortenAtWord } from '#shared/utils/text'
import type { Poster } from '#shared/types'
import { fmtRange, nowStamp } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const input = await parseBody(event, posterSchema)

  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  const poster: Poster = {
    ...fields,
    id: nextId(input.kind === 'pengumuman' ? 'a' : 'p'),
    name: fields.name || (input.kind === 'pengumuman' ? shortenAtWord(input.text, 40) : ''),
    archived: false,
    updatedAt: nowStamp(),
    updatedBy: user.id,
  }
  db.posters.unshift(poster)
  if (poster.kind === 'gambar') placePoster(poster.id, pageIds)
  logAudit(
    user.id,
    poster.status === 'published' ? 'Menerbitkan' : 'Membuat',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    poster.name,
    '',
    poster.status === 'published' ? `Terbit · ${fmtRange(poster.start, poster.end)}` : 'Draft',
  )
  return poster
})
