import { z } from 'zod'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const { archived, undo } = await parseBody(
    event,
    z.object({ archived: z.boolean(), undo: z.boolean().optional() }).strict(),
  )
  // "Urungkan" right after archiving puts the poster back exactly as it was. A later restore
  // from the Arsip tab comes back as Draft, so nothing old goes live by accident.
  const undoing = !archived && undo === true && poster.archived && poster.archivedFrom !== undefined
  const restoredStatus = undoing ? poster.archivedFrom! : 'draft'
  const denial = emergencyDenial(
    user,
    poster,
    archived ? null : { ...poster, archived: false, status: restoredStatus },
  )
  if (denial) throw createError(denial)
  const content = await useContent()
  // An archived poster has nothing to publish: a waiting request is dropped with it.
  if (archived && poster.pending) await content.clearPending(poster.id)
  const updated = await content.patchPoster(
    poster.id,
    archived
      ? { archived: true, archivedFrom: poster.status }
      : { archived: false, archivedFrom: null, status: restoredStatus },
    user.id,
  )
  await logAudit(
    user.id,
    archived ? 'Mengarsipkan' : 'Memulihkan',
    'Poster',
    poster.name,
    archived ? 'Aktif' : 'Diarsipkan',
    archived ? 'Diarsipkan' : restoredStatus === 'published' ? 'Terbit' : 'Draft',
  )
  return updated
})
