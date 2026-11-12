import { z } from 'zod'
import { nowStamp } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = requireUser(event)
  const poster = findPosterOr404(getRouterParam(event, 'id'))
  const { archived, undo } = await parseBody(event, z.object({ archived: z.boolean(), undo: z.boolean().optional() }).strict())
  // "Urungkan" right after archiving puts the poster back exactly as it was. A later restore
  // from the Arsip tab comes back as Draft, so nothing old goes live by accident.
  const undoing = !archived && undo === true && poster.archived && poster.archivedFrom !== undefined
  const restoredStatus = undoing ? poster.archivedFrom! : 'draft'
  if (archived) poster.archivedFrom = poster.status
  else {
    poster.status = restoredStatus
    delete poster.archivedFrom
  }
  poster.archived = archived
  poster.updatedAt = nowStamp()
  poster.updatedBy = user.id
  logAudit(
    user.id,
    archived ? 'Mengarsipkan' : 'Memulihkan',
    'Poster',
    poster.name,
    archived ? 'Aktif' : 'Diarsipkan',
    archived ? 'Diarsipkan' : restoredStatus === 'published' ? 'Terbit' : 'Draft',
  )
  return poster
})
