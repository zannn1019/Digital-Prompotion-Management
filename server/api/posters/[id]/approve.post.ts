import { fmtRange } from '#shared/utils/format'

// An Approver (or Super Admin) puts a submitted change live.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  if (!canApprove(user)) throw createError({ statusCode: 403, statusMessage: APPROVER_ONLY })
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  if (!poster.pending)
    throw createError({
      statusCode: 409,
      statusMessage: 'Tidak ada perubahan yang menunggu persetujuan untuk konten ini.',
    })
  // A live emergency announcement stays a Super Admin decision, also when approving one.
  const denial = emergencyDenial(user, poster, {
    ...poster.pending.fields,
    archived: poster.archived,
  })
  if (denial) throw createError(denial)

  const approved = await (await useContent()).approveChange(poster.id, user.id)
  if (!approved)
    throw createError({
      statusCode: 409,
      statusMessage: 'Perubahan ini sudah ditangani orang lain. Muat ulang halaman.',
    })
  const submitter = (await (await useUsers()).names()).get(poster.pending.by) ?? '-'
  await logAudit(
    user.id,
    'Menyetujui',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    approved.name,
    `Diajukan ${submitter}`,
    approved.status === 'published'
      ? `Terbit · ${fmtRange(approved.start, approved.end)}`
      : 'Draft',
  )
  return approved
})
