import type { Page } from '#shared/types'
import { nowStamp } from '#shared/utils/format'

// New pages start empty and as Draft; cards can be mapped to them once they are published.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { name } = await parseBody(event, pageCreateSchema)
  if (db.pages.some(p => p.name.toLowerCase() === name.toLowerCase()))
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { name: 'Nama ini sudah dipakai halaman lain.' } },
    })

  const page: Page = { id: nextId('pg'), name, theme: 'ungu', status: 'draft', isDefault: false, posterIds: [], updatedAt: nowStamp() }
  db.pages.push(page)
  logAudit(user.id, 'Membuat', 'Halaman', name, '', 'Draft')
  return { ...page, cardCount: 0 }
})
