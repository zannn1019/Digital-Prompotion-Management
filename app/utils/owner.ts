/** Whether an item passes the marketing filter ('' everyone, 'none' nobody assigned, else a user id). */
export function ownerMatches(ownerId: string | null | undefined, filter: string): boolean {
  if (!filter) return true
  if (filter === 'none') return !ownerId
  return ownerId === filter
}
