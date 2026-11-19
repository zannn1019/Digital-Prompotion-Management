// Analytics per marketing user. Pure logic, no auto-imports, so tests can use it.
import type { Card, DailyRow, Poster, User } from '#shared/types'

export interface MarketingStat {
  /** Null for the row of cards and posters nobody owns yet. */
  id: string | null
  name: string
  cards: number
  posters: number
  /** Taps on the cards this person owns. */
  taps: number
  /** Contact-button clicks (WhatsApp, phone, brochure) on the posters this person owns, from any card. */
  clicks: number
}

/**
 * One row per marketing user, most clicks first (then most taps). Taps count for the card's owner and
 * clicks for the poster's owner, so a poster shown on someone else's card still counts for its marketer.
 * Every active marketing user is listed, also with zero; others only when they still own something.
 * A last "Belum ada marketing" row holds what nobody owns, when there is any.
 */
export function byMarketing(
  rows: Pick<DailyRow, 'card' | 'taps' | 'clicks'>[],
  cards: Pick<Card, 'code' | 'ownerId'>[],
  posters: Pick<Poster, 'id' | 'kind' | 'ownerId'>[],
  users: Pick<User, 'id' | 'name' | 'role' | 'status'>[],
): MarketingStat[] {
  const NONE = ''
  const stats = new Map<string, MarketingStat>()
  const stat = (id: string) => {
    let s = stats.get(id)
    if (!s) {
      const u = users.find(x => x.id === id)
      s = {
        id: id || null,
        name: id ? (u?.name ?? 'Pengguna dihapus') : 'Belum ada marketing',
        cards: 0,
        posters: 0,
        taps: 0,
        clicks: 0,
      }
      stats.set(id, s)
    }
    return s
  }
  for (const u of users) if (u.role === 'marketing' && u.status === 'active') stat(u.id)

  const cardOwner = new Map(cards.map(c => [c.code, c.ownerId ?? NONE]))
  const posterOwner = new Map(posters.map(p => [p.id, p.ownerId ?? NONE]))
  for (const c of cards) stat(c.ownerId ?? NONE).cards++
  for (const p of posters) if (p.kind === 'gambar') stat(p.ownerId ?? NONE).posters++

  for (const r of rows) {
    if (r.taps) stat(cardOwner.get(r.card) ?? NONE).taps += r.taps
    for (const [key, n] of Object.entries(r.clicks)) {
      const posterId = key.split('|')[0]!
      stat(posterOwner.get(posterId) ?? NONE).clicks += n
    }
  }

  const none = stats.get(NONE)
  stats.delete(NONE)
  const list = [...stats.values()].sort(
    (a, b) => b.clicks - a.clicks || b.taps - a.taps || a.name.localeCompare(b.name, 'id'),
  )
  if (none && (none.cards || none.posters || none.taps || none.clicks)) list.push(none)
  return list
}
