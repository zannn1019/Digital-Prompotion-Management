/** "Rina Kartika" → "RK" (avatar initials). */
export function initials(name: string | undefined | null) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
