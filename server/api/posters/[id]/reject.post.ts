// An Approver (or Super Admin) turns a submitted change down, with a reason the submitter sees.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  if (!canApprove(user)) throw createError({ statusCode: 403, statusMessage: APPROVER_ONLY })
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const { note } = await parseBody(event, rejectSchema)
  if (!poster.pending)
    throw createError({
      statusCode: 409,
      statusMessage: 'Tidak ada perubahan yang menunggu persetujuan untuk konten ini.',
    })
  const rejected = await (await useContent()).rejectChange(poster.id, note, user.id)
  await logAudit(
    user.id,
    'Menolak',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    poster.name,
    'Menunggu persetujuan',
    `Ditolak: ${note}`,
  )
  return rejected
})
