import type { Match, Team } from '@/lib/server/db'
import { computeStandings, type StandingRow } from './standings'

export type KnockoutFormat = 'semis' | 'final'

export const SEMI_1 = 'Semi-final 1'
export const SEMI_2 = 'Semi-final 2'
export const FINAL = 'Final'
export const LEAGUE_STAGE = 'League Match'

export const isSemi = (m: Pick<Match, 'stage'>) => m.stage === SEMI_1 || m.stage === SEMI_2
export const isFinal = (m: Pick<Match, 'stage'>) => m.stage === FINAL
/** Everything that is not a semi-final or the final counts towards the points table */
export const isLeagueMatch = (m: Pick<Match, 'stage'>) => !isSemi(m) && !isFinal(m)

export const qualifiersFor = (format: KnockoutFormat) => (format === 'final' ? 2 : 4)

export type Pairing = { stage: string; teamA: string; teamB: string }

export type PlayoffPhase =
  | { phase: 'unset' } // league match count not chosen yet
  | { phase: 'league'; played: number; scheduled: number; total: number } // league stage still going
  | { phase: 'semis-ready'; pairings: Pairing[] }
  | { phase: 'semis'; } // semi-finals created, waiting for both results
  | { phase: 'final-ready'; pairings: Pairing[] }
  | { phase: 'final' } // final created, waiting for its result
  | { phase: 'done'; champion: string }
  | { phase: 'too-few-teams'; needed: number }

/**
 * The team that goes through from a knockout match. A tie or no result sends the side
 * that finished higher in the league table through.
 */
export function knockoutWinner(m: Match, table: StandingRow[]): string | null {
  if (m.status !== 'Completed' || !m.resultType) return null
  if (m.resultType === 'win' && m.winner) return m.winner
  const rank = (name: string) => {
    const i = table.findIndex(r => r.team.name === name)
    return i < 0 ? Infinity : i
  }
  return rank(m.teamA) <= rank(m.teamB) ? m.teamA : m.teamB
}

export function playoffPhase(
  teams: Team[],
  matches: Match[],
  leagueMatches: number | null | undefined,
  format: KnockoutFormat
): PlayoffPhase {
  const league = matches.filter(isLeagueMatch)
  const semis = matches.filter(isSemi)
  const final = matches.find(isFinal)
  const table = computeStandings(teams, league)

  if (final) {
    const champ = knockoutWinner(final, table)
    return champ ? { phase: 'done', champion: champ } : { phase: 'final' }
  }

  if (semis.length > 0) {
    const winners = [SEMI_1, SEMI_2].map(s => {
      const m = semis.find(x => x.stage === s)
      return m ? knockoutWinner(m, table) : null
    })
    if (winners[0] && winners[1]) {
      return { phase: 'final-ready', pairings: [{ stage: FINAL, teamA: winners[0], teamB: winners[1] }] }
    }
    return { phase: 'semis' }
  }

  if (!leagueMatches) return { phase: 'unset' }
  const played = league.filter(m => m.status === 'Completed' && m.resultType).length
  if (league.length < leagueMatches || played < league.length) {
    return { phase: 'league', played, scheduled: league.length, total: leagueMatches }
  }

  const needed = qualifiersFor(format)
  if (teams.length < needed) return { phase: 'too-few-teams', needed }
  const top = table.slice(0, needed).map(r => r.team.name)
  if (format === 'final') {
    return { phase: 'final-ready', pairings: [{ stage: FINAL, teamA: top[0], teamB: top[1] }] }
  }
  return {
    phase: 'semis-ready',
    pairings: [
      { stage: SEMI_1, teamA: top[0], teamB: top[3] },
      { stage: SEMI_2, teamA: top[1], teamB: top[2] }
    ]
  }
}
