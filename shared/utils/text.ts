/**
 * Shortens text to at most `max` characters at a word boundary, with "…" when something was cut.
 * Used for the internal name of an announcement, taken from its text.
 */
export function shortenAtWord(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  // Keep at least half the room; one very long word is cut as is.
  return `${(space >= max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:–-]+$/, '')}…`
}
