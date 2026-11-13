import { nowStamp } from '#shared/utils/format'

export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const page = db.pages.find(p => p.id === getRouterParam(event, 'id'))
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Halaman tidak ditemukan.' })
  const input = await parseBody(event, pageUpdateSchema)

  if (input.posterIds) {
    const before = `${page.posterIds.length} poster`
    // Only existing image posters can be placed; duplicates are dropped.
    page.posterIds = [...new Set(input.posterIds)].filter(id => db.posters.some(p => p.id === id && p.kind === 'gambar'))
    logAudit(user.id, 'Mengubah', 'Halaman', page.name, before, `${page.posterIds.length} poster (urutan diperbarui)`)
  }
  if (input.isDefault) {
    const prev = db.pages.find(p => p.isDefault)
    db.pages.forEach(p => {
      p.isDefault = p.id === page.id
    })
    logAudit(user.id, 'Mengubah', 'Halaman', 'Halaman umum default', prev?.name ?? '', page.name)
  }
  if (input.status) {
    page.status = input.status
    logAudit(
      user.id,
      input.status === 'published' ? 'Menerbitkan' : 'Mengubah',
      'Halaman',
      page.name,
      '',
      input.status === 'published' ? 'Terbit' : 'Draft',
    )
  }
  if (input.name) page.name = input.name
  if (input.theme) page.theme = input.theme
  page.updatedAt = nowStamp()
  return page
})
