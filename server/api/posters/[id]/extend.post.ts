import { z } from 'zod'
import { addDays, fmtDate } from '#shared/utils/format'

// Quick "Perpanjang" from the dashboard: moves only the end date, so the
// content maker does not have to walk through the whole poster form.
const schema = z
  .object({
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal belum benar.')
      .refine(s => addDays(s, 0) === s, 'Tanggal belum benar.'),
  })
  .strict()

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const poster = await findPosterOr404(getRouterParam(event, 'id'))
  const { end } = await parseBody(event, schema)
  const denial = emergencyDenial(user, poster, poster)
  if (denial) throw createError(denial)
  // After the current end, and at most a year past it (a typo like 9999 can't keep a poster live forever).
  const problem = extendEndProblem(poster.end, end)
  if (problem)
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { end: problem } },
    })
  const before = fmtDate(poster.end)
  const content = await useContent()
  const entity = poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster'

  // Staff and Marketing extending a published poster: the new end date waits for an Approver, on top of
  // any change they already submitted.
  if (needsApproval(user, poster)) {
    const base = poster.pending ?? {
      fields: pendingFieldsOf(poster),
      pageIds: (await content.pagesOfPosters()).get(poster.id)?.map(p => p.id),
    }
    const submitted = await content.submitChange(
      poster.id,
      { fields: { ...base.fields, end }, pageIds: base.pageIds },
      user.id,
    )
    await logAudit(
      user.id,
      'Mengajukan',
      entity,
      poster.name,
      `s/d ${before}`,
      `Perpanjang s/d ${fmtDate(end)} · menunggu persetujuan`,
    )
    return submitted
  }

  const updated = await content.patchPoster(poster.id, { end }, user.id)
  await logAudit(
    user.id,
    'Memperpanjang',
    entity,
    poster.name,
    `s/d ${before}`,
    `s/d ${fmtDate(end)}`,
  )
  return updated
})
