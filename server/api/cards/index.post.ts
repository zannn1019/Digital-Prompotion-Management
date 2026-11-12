import { randomInt } from 'node:crypto'
import type { Card } from '#shared/types'

// Unambiguous characters only (no 0/O, 1/I). 32^8 ≈ 10^12 codes: not guessable.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return db.cards.some(c => c.code === s) ? randomCode() : s
}

export default defineEventHandler(async event => {
  const user = requireUser(event, 'super')
  const { count, label, group, pageId } = await parseBody(event, cardRegisterSchema)
  if (pageId && !db.pages.some(p => p.id === pageId)) throw createError({ statusCode: 422, statusMessage: 'Pilih halaman tujuan.' })

  const created: Card[] = Array.from({ length: count }, (_, i) => ({
    code: randomCode(),
    label: count > 1 ? `${label} ${i + 1}` : label,
    group,
    pageId,
    status: 'aktif',
    writeStatus: 'belum',
    writtenAt: null,
    writtenBy: null,
    locked: false,
    lastTap: null,
  }))
  db.cards.unshift(...created)
  logAudit(user.id, 'Mendaftarkan', 'Kartu', `${count} kartu · ${group}`, '', 'Belum ditulis')
  return created
})
