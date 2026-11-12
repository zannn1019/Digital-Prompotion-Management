/** Puts a poster on exactly the given pages (appended at the end of new pages). */
export function placePoster(posterId: string, pageIds: string[] | undefined) {
  if (!pageIds) return
  for (const page of db.pages) {
    const has = page.posterIds.includes(posterId)
    const want = pageIds.includes(page.id)
    if (want && !has) page.posterIds.push(posterId)
    if (!want && has) page.posterIds = page.posterIds.filter(id => id !== posterId)
  }
}

export function findPosterOr404(id: string | undefined) {
  const poster = db.posters.find(p => p.id === id)
  if (!poster) throw createError({ statusCode: 404, statusMessage: 'Poster tidak ditemukan.' })
  return poster
}
