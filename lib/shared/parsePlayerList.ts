import { BASE_PRICE } from './rules'

export type ParsedPlayer = { name: string; base: number }

const LIST_MARKER = /^(?:[-*•·]+\s*|\(?\d+\s*[.):-]\s*|\d+\s+)/
const TRAILING_PRICE = /\s*[,:;-]\s*(?:₹|rs\.?\s*)?(\d[\d,]*)\s*(?:rs)?$/i

/**
 * Reads a pasted player list: one per line or comma separated, with or without list numbers
 * and bullets. A line can end with a base price, as in "Rohit Sharma, 700".
 */
export function parsePlayerList(text: string): ParsedPlayer[] {
  const players: ParsedPlayer[] = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(LIST_MARKER, '')
    if (!line) continue

    const price = line.match(TRAILING_PRICE)
    const base = (price && Number(price[1].replace(/,/g, ''))) || BASE_PRICE
    const names = (price ? line.slice(0, price.index) : line).split(',')

    for (const rawName of names) {
      const name = rawName.trim().replace(LIST_MARKER, '').replace(/\s+/g, ' ')
      if (name) players.push({ name, base })
    }
  }
  return players
}

/** Drops names already in the pool or repeated in the list, ignoring upper and lower case. */
export function withoutDuplicates(list: ParsedPlayer[], existingNames: string[]) {
  const seen = new Set(existingNames.map(name => name.toLowerCase()))
  const fresh = list.filter(p => {
    const key = p.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { fresh, skipped: list.length - fresh.length }
}
