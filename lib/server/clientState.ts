import { createHash } from 'crypto'
import type { DatabaseSchema, Match, Team } from './db'
import { auctionSnapshot, type AuctionSnapshot } from './services/auctionService'
import { WHEEL_REVEAL_PAUSE_MS, WHEEL_SPIN_MS } from '@/lib/shared/rules'

/** Everything a screen shows, in one reply. Sent by GET /api/state and with every change. */
export type ClientState = AuctionSnapshot & {
  rev: number | null
  matches: Match[]
  league: DatabaseSchema['league']
}

const logoVersions = new Map<string, string>()

/** Logos travel as cacheable links, so a refresh does not resend the images. */
function withLogoLink(team: Team): Team {
  if (!team.logo) return team
  let version = logoVersions.get(team.logo)
  if (!version) {
    version = createHash('sha1').update(team.logo).digest('hex').slice(0, 12)
    if (logoVersions.size > 200) logoVersions.clear()
    logoVersions.set(team.logo, version)
  }
  return { ...team, logo: `/api/teams/${encodeURIComponent(team.id)}/logo?v=${version}` }
}

export function buildClientState(db: DatabaseSchema): ClientState {
  const auction = auctionSnapshot(db)
  return {
    ...auction,
    teams: auction.teams.map(withLogoLink),
    leader: auction.leader && withLogoLink(auction.leader),
    rev: db.rev ?? null,
    matches: db.matches,
    league: db.league
  }
}

/** A screen already at this revision has nothing new, unless a wheel spin is still playing out. */
export function isUnchanged(rev: number | null, spinStartedAt: number | null, screenRev: number): boolean {
  if (rev === null || rev !== screenRev) return false
  // The snapshot changes during and just after a spin without a new save, so keep sending it then
  return !spinStartedAt || Date.now() > spinStartedAt + WHEEL_SPIN_MS + WHEEL_REVEAL_PAUSE_MS + 8000
}
