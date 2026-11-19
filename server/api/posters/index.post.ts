import { shortenAtWord } from '#shared/utils/text'
import { fmtRange } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const input = await parseBody(event, posterSchema)
  const denial = emergencyDenial(user, null, input)
  if (denial) throw createError(denial)

  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  const name = fields.name || (input.kind === 'pengumuman' ? shortenAtWord(input.text, 40) : '')
  const ownerId = await resolveOwner(fields.ownerId, user)
  const entity = input.kind === 'pengumuman' ? 'Pengumuman' : 'Poster'
  const content = await useContent()

  // Staff and Marketing: the poster is saved as a Draft (not visible) and the publish request waits
  // for an Approver, with the pages it should go on.
  if (needsApproval(user, input)) {
    const draft = await content.createPoster({ ...fields, name, ownerId, status: 'draft' }, user.id)
    const submitted = await content.submitChange(
      draft.id,
      {
        fields: { ...fields, name, ownerId },
        pageIds: input.kind === 'gambar' ? pageIds : undefined,
      },
      user.id,
    )
    await logAudit(
      user.id,
      'Mengajukan',
      entity,
      draft.name,
      '',
      `Menunggu persetujuan · ${fmtRange(input.start, input.end)}`,
    )
    return submitted!
  }

  // Only image posters go on pages; announcements show on every page.
  const poster = await content.createPoster(
    { ...fields, name, ownerId },
    user.id,
    input.kind === 'gambar' ? pageIds : undefined,
  )
  await logAudit(
    user.id,
    poster.status === 'published' ? 'Menerbitkan' : 'Membuat',
    entity,
    poster.name,
    '',
    poster.status === 'published' ? `Terbit · ${fmtRange(poster.start, poster.end)}` : 'Draft',
  )
  return poster
})
