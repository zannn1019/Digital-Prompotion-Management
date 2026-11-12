import { z } from 'zod'
import { addDays, fmtDate, nowStamp } from '#shared/utils/format'

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
  const user = requireUser(event)
  const poster = findPosterOr404(getRouterParam(event, 'id'))
  const { end } = await parseBody(event, schema)
  // After the current end, and at most a year past it (a typo like 9999 can't keep a poster live forever).
  const problem = extendEndProblem(poster.end, end)
  if (problem) throw createError({ statusCode: 422, statusMessage: 'Periksa isian', data: { errors: { end: problem } } })
  const before = fmtDate(poster.end)
  poster.end = end
  poster.updatedAt = nowStamp()
  poster.updatedBy = user.id
  logAudit(
    user.id,
    'Memperpanjang',
    poster.kind === 'pengumuman' ? 'Pengumuman' : 'Poster',
    poster.name,
    `s/d ${before}`,
    `s/d ${fmtDate(end)}`,
  )
  return poster
})
