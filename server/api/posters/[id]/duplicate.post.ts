export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const { id: _id, updatedAt: _u, updatedBy: _b, archivedFrom: _a, ...fields } = poster
  // The copy starts as a Draft on no page, so nothing goes live twice by accident.
  const copy = await (
    await useContent()
  ).createPoster({ ...fields, name: `${poster.name} (salinan)`, status: 'draft', archived: false }, user.id)
  await logAudit(
    user.id,
    'Membuat',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    copy.name,
    '',
    `Salinan dari “${poster.name}” · Draft`,
  )
  return copy
})
