import type { Team } from '@/lib/server/db'

export const BASE_PRICE = 500

// A spin is scheduled this far ahead, so polling screens hear about it before it starts
export const WHEEL_LEAD_MS = 2500
export const WHEEL_SPIN_MS = 3200
export const WHEEL_REVEAL_PAUSE_MS = 500

/** The most a team may pay for one player while keeping the base price for each other open squad place. */
export function maxBidFor(team: Pick<Team, 'purse' | 'players'>, maxSquadSize: number): number {
  const openSlots = maxSquadSize - team.players
  if (openSlots <= 0) return 0
  return Math.max(0, team.purse - (openSlots - 1) * BASE_PRICE)
}
