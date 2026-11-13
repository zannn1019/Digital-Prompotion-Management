// Called by the phone writer after it wrote (and read back) the card.
export default defineEventHandler(async event => {
  const user = await requireUser(event)
  const repo = await useCardsRepo()
  const card = await repo.byCode(getRouterParam(event, 'code') ?? '')
  if (!card) throw createError({ statusCode: 404, statusMessage: 'Kartu tidak ditemukan.' })
  const { ok, locked = false } = await parseBody(event, cardWriteSchema)
  const before = card.writeStatus === 'sudah' ? 'Sudah ditulis' : 'Belum ditulis'
  const updated = (await repo.recordWrite(card.code, ok, locked, user.id))!
  await logAudit(
    user.id,
    'Menulis',
    'Kartu',
    `${card.code} · ${card.label}`,
    before,
    ok ? `Sudah ditulis${updated.locked ? ' · terkunci' : ''}` : 'Gagal (kartu bergeser)',
  )
  return updated
})
