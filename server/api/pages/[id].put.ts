export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const content = await useContent()
  const page = await content.pageById(getRouterParam(event, 'id') ?? '')
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Halaman tidak ditemukan.' })
  const input = await parseBody(event, pageUpdateSchema)

  // Renaming is checked first: a name already in use stops the whole save.
  if (input.name || input.theme || input.status) {
    const result = await content.updatePage(page.id, { name: input.name, theme: input.theme, status: input.status })
    if (result === 'name-taken')
      throw createError({
        statusCode: 422,
        statusMessage: 'Periksa isian',
        data: { errors: { name: 'Nama ini sudah dipakai halaman lain.' } },
      })
  }
  if (input.posterIds) {
    // Only existing image posters can be placed; duplicates are dropped.
    const kept = await content.setPagePosters(page.id, input.posterIds)
    await logAudit(
      user.id,
      'Mengubah',
      'Halaman',
      page.name,
      `${page.posterIds.length} poster`,
      `${kept.length} poster (urutan diperbarui)`,
    )
  }
  if (input.isDefault) {
    const prev = await content.defaultPage()
    await content.setDefaultPage(page.id)
    await logAudit(user.id, 'Mengubah', 'Halaman', 'Halaman umum default', prev?.name ?? '', page.name)
  }
  if (input.status)
    await logAudit(
      user.id,
      input.status === 'published' ? 'Menerbitkan' : 'Mengubah',
      'Halaman',
      input.name ?? page.name,
      '',
      input.status === 'published' ? 'Terbit' : 'Draft',
    )
  return (await content.pageById(page.id))!
})
