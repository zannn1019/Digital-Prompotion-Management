import type { Poster } from '#shared/types'

/** The poster with this ID, or a 404. */
export async function findPosterOr404(id: string | undefined): Promise<Poster> {
  const poster = id ? await (await useContent()).posterById(id) : null
  if (!poster) throw createError({ statusCode: 404, statusMessage: 'Poster tidak ditemukan.' })
  return poster
}
