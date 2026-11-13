import { shortenAtWord } from '#shared/utils/text'
import { fmtRange } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const input = await parseBody(event, posterSchema)

  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  const name = fields.name || (input.kind === 'pengumuman' ? shortenAtWord(input.text, 40) : '')
  // Only image posters go on pages; announcements show on every page.
  const poster = await (await useContent()).createPoster({ ...fields, name }, user.id, input.kind === 'gambar' ? pageIds : undefined)
  await logAudit(
    user.id,
    poster.status === 'published' ? 'Menerbitkan' : 'Membuat',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    poster.name,
    '',
    poster.status === 'published' ? `Terbit · ${fmtRange(poster.start, poster.end)}` : 'Draft',
  )
  return poster
})
