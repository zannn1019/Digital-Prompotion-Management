import type { PendingFields, Poster } from '#shared/types'

/** The poster with this ID, or a 404. */
export async function findPosterOr404(id: string | undefined): Promise<Poster> {
  const poster = id ? await (await useContent()).posterById(id) : null
  if (!poster) throw createError({ statusCode: 404, statusMessage: 'Poster tidak ditemukan.' })
  return poster
}

/** The poster's own editable fields, as an approval request carries them (no id, dates or review data). */
export function pendingFieldsOf(p: Poster): PendingFields {
  const {
    id: _id,
    updatedAt: _u,
    updatedBy: _b,
    archived: _a,
    archivedFrom: _f,
    pending: _p,
    rejection: _r,
    ...fields
  } = p
  return fields
}
