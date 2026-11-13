// Bulk actions on selected cards: map to a page, deactivate, or reactivate.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { codes, action, pageId = null } = await parseBody(event, cardBulkSchema)
  // Staff may map cards; status changes are Super Admin only.
  if (action !== 'map' && user.role !== 'super')
    throw createError({ statusCode: 403, statusMessage: 'Hanya Super Admin yang bisa mengubah status kartu.' })
  const targets = db.cards.filter(c => codes.includes(c.code))
  if (!targets.length) throw createError({ statusCode: 422, statusMessage: 'Pilih minimal satu kartu.' })

  if (action === 'map') {
    const page = pageId ? db.pages.find(p => p.id === pageId) : null
    if (pageId && !page) throw createError({ statusCode: 422, statusMessage: 'Pilih halaman tujuan.' })
    const before = [...new Set(targets.map(c => db.pages.find(p => p.id === c.pageId)?.name ?? 'Halaman umum'))].join(', ')
    targets.forEach(c => {
      c.pageId = pageId
    })
    logAudit(user.id, 'Memetakan', 'Kartu', `${targets.length} kartu`, before, page?.name ?? 'Halaman umum')
  } else {
    const off = action === 'deactivate'
    targets.forEach(c => {
      c.status = off ? 'nonaktif' : 'aktif'
    })
    logAudit(
      user.id,
      off ? 'Menonaktifkan' : 'Mengaktifkan',
      'Kartu',
      targets.map(c => c.code).join(', '),
      off ? 'Aktif' : 'Nonaktif',
      off ? 'Nonaktif' : 'Aktif',
    )
  }
  return { updated: targets.length }
})
