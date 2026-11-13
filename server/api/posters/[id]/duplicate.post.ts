import { nowStamp } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = findPosterOr404(getRouterParam(event, 'id'))
  const copy = {
    ...poster,
    id: nextId(poster.kind === 'pengumuman' ? 'a' : 'p'),
    name: `${poster.name} (salinan)`,
    status: 'draft' as const,
    archived: false,
    archivedFrom: undefined,
    updatedAt: nowStamp(),
    updatedBy: user.id,
  }
  db.posters.unshift(copy)
  logAudit(user.id, 'Membuat', 'Poster', copy.name, '', `Salinan dari “${poster.name}” · Draft`)
  return copy
})
