export default defineEventHandler(async event => {
  const user = await requireUser(event, 'super')
  const { count, label, group, pageId } = await parseBody(event, cardRegisterSchema)
  if (pageId && !(await (await useContent()).pageById(pageId)))
    throw createError({ statusCode: 422, statusMessage: 'Pilih halaman tujuan.' })

  const created = await (await useCardsRepo()).create({ count, label, group, pageId })
  await logAudit(user.id, 'Mendaftarkan', 'Kartu', `${count} kartu · ${group}`, '', 'Belum ditulis')
  return created
})
