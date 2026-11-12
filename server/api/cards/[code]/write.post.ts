import { nowStamp } from '#shared/utils/format'

// Called by the phone writer after it wrote (and read back) the card.
export default defineEventHandler(async event => {
  const user = requireUser(event)
  const card = db.cards.find(c => c.code === getRouterParam(event, 'code'))
  if (!card) throw createError({ statusCode: 404, statusMessage: 'Kartu tidak ditemukan.' })
  const { ok, locked = false } = await parseBody(event, cardWriteSchema)
  const before = card.writeStatus === 'sudah' ? 'Sudah ditulis' : 'Belum ditulis'
  if (ok) {
    card.writeStatus = 'sudah'
    card.writtenAt = nowStamp()
    card.writtenBy = user.id
    card.locked = card.locked || locked
  } else {
    card.writeStatus = card.writeStatus === 'sudah' ? 'sudah' : 'gagal'
  }
  logAudit(
    user.id,
    'Menulis',
    'Kartu',
    `${card.code} · ${card.label}`,
    before,
    ok ? `Sudah ditulis${card.locked ? ' · terkunci' : ''}` : 'Gagal (kartu bergeser)',
  )
  return card
})
