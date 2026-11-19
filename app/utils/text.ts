/** Leading titles such as "dr.", "drg.", "Prof.", "Hj." end with a dot. */
const isTitle = (word: string) => word.endsWith('.')

/** "Rina Kartika" → "RK", "dr. Hendra Wijaya" → "HW" (avatar initials; titles are skipped). */
export function initials(name: string | undefined | null) {
  const words = (name ?? '').split(/\s+/).filter(Boolean)
  const named = words.filter(w => !isTitle(w))
  return (named.length ? named : words)
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** How to address someone briefly: "Rina Kartika" → "Rina", "dr. Hendra Wijaya" → "dr. Hendra". */
export function shortName(name: string | undefined | null) {
  const words = (name ?? '').split(/\s+/).filter(Boolean)
  let i = 0
  while (i < words.length - 1 && isTitle(words[i]!)) i++
  return words.slice(0, i + 1).join(' ')
}
