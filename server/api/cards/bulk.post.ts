// Bulk actions on selected cards: map to a page, deactivate, or reactivate.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { codes, action, pageId = null } = await parseBody(event, cardBulkSchema)
  // Staff may map cards; status changes are Super Admin only.
  if (action !== 'map' && user.role !== 'super')
    throw createError({ statusCode: 403, statusMessage: 'Hanya Super Admin yang bisa mengubah status kartu.' })
  const repo = await useCardsRepo()
  const targets = await repo.byCodes(codes)
  if (!targets.length) throw createError({ statusCode: 422, statusMessage: 'Pilih minimal satu kartu.' })
  const found = targets.map(c => c.code)

  if (action === 'map') {
    const content = await useContent()
    const page = pageId ? await content.pageById(pageId) : null
    if (pageId && !page) throw createError({ statusCode: 422, statusMessage: 'Pilih halaman tujuan.' })
    const pageName = new Map((await content.listPages()).map(p => [p.id, p.name]))
    const before = [...new Set(targets.map(c => (c.pageId && pageName.get(c.pageId)) || 'Halaman umum'))].join(', ')
    await repo.mapToPage(found, pageId)
    await logAudit(user.id, 'Memetakan', 'Kartu', `${targets.length} kartu`, before, page?.name ?? 'Halaman umum')
  } else {
    const off = action === 'deactivate'
    await repo.setStatus(found, off ? 'nonaktif' : 'aktif')
    await logAudit(
      user.id,
      off ? 'Menonaktifkan' : 'Mengaktifkan',
      'Kartu',
      found.join(', '),
      off ? 'Aktif' : 'Nonaktif',
      off ? 'Nonaktif' : 'Aktif',
    )
  }
  return { updated: targets.length }
})
