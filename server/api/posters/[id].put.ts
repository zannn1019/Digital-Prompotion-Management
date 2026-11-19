import type { Poster } from '#shared/types'
import { fmtRange } from '#shared/utils/format'

const describe = (p: Pick<Poster, 'status' | 'start' | 'end'>) =>
  p.status === 'published' ? `Terbit · ${fmtRange(p.start, p.end)}` : 'Draft'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const input = await parseBody(
    event,
    poster.kind === 'pengumuman' ? announcementSchema : imagePosterSchema,
  )
  const denial = emergencyDenial(user, poster, { ...input, archived: poster.archived })
  if (denial) throw createError(denial)

  const { pageIds, ...fields } = input.kind === 'gambar' ? input : { ...input, pageIds: undefined }
  const ownerId = await resolveOwner(fields.ownerId, user, poster.ownerId ?? null)
  const entity = poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster'
  const content = await useContent()
  // Only schema-checked fields are saved; id, kind and archive state never change here.
  // An editor design or brochure sent as null is cleared (a plain uploaded file replaces a design).
  const next = {
    ...fields,
    kind: poster.kind,
    name: fields.name || poster.name,
    ownerId,
  }

  // Staff and Marketing asking to publish: the change waits for an Approver. A live poster stays exactly
  // as approved; a Draft also takes the new content (still as Draft) so the lists show the latest.
  if (needsApproval(user, input)) {
    if (poster.status !== 'published')
      await content.replacePoster(
        poster.id,
        { ...next, status: poster.status, archivedFrom: poster.archivedFrom },
        user.id,
      )
    const submitted = await content.submitChange(
      poster.id,
      { fields: next, pageIds: poster.kind === 'gambar' ? pageIds : undefined },
      user.id,
    )
    await logAudit(
      user.id,
      'Mengajukan',
      entity,
      next.name,
      describe(poster),
      `Menunggu persetujuan · ${fmtRange(input.start, input.end)}`,
    )
    return submitted!
  }

  const updated = await content.replacePoster(
    poster.id,
    { ...next, archivedFrom: poster.archivedFrom },
    user.id,
    poster.kind === 'gambar' ? pageIds : undefined,
  )
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Poster tidak ditemukan.' })
  // Staff or Marketing saving a Draft withdraws their own waiting request (it would otherwise publish
  // an older version later). An Approver editing directly leaves the request for review.
  if (!canApprove(user) && poster.pending) await content.clearPending(poster.id)
  await logAudit(user.id, 'Mengubah', entity, updated.name, describe(poster), describe(updated))
  return canApprove(user) || !poster.pending ? updated : { ...updated, pending: null }
})
