// New pages start empty and as Draft; cards can be mapped to them once they are published.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const { name } = await parseBody(event, pageCreateSchema)
  // The unique index on lower(name) decides, so two requests at once can't both take a name.
  const page = await (await useContent()).createPage(name)
  if (!page)
    throw createError({
      statusCode: 422,
      statusMessage: 'Periksa isian',
      data: { errors: { name: 'Nama ini sudah dipakai halaman lain.' } },
    })
  await logAudit(user.id, 'Membuat', 'Halaman', name, '', 'Draft')
  return { ...page, cardCount: 0 }
})
