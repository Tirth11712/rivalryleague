import type { Match, Team, InningsScore } from '@/lib/server/db'

export const WIN_POINTS = 2
export const TIE_POINTS = 1
const NO_RESULT_POINTS = 1
export const DEFAULT_OVERS = 10

/** "7.3" -> 45 balls. Returns null when the notation is invalid (balls digit must be 0-5). */
export function parseOvers(input: string | number): number | null {
  const text = String(input).trim()
  if (!/^\d+(\.\d)?$/.test(text)) return null
  const [whole, part = '0'] = text.split('.')
  const balls = Number(part)
  if (balls > 5) return null
  return Number(whole) * 6 + balls
}

/** 45 balls -> "7.3" */
export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`
}

/** Overs credited for NRR: a side that was bowled out is charged the full quota (ICC rule). */
function chargedBalls(s: InningsScore, oversLimit: number): number {
  return s.allOut ? oversLimit * 6 : s.balls
}

export type StandingRow = {
  team: Team
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  nrr: number
  form: Array<'W' | 'L' | 'T' | 'N'>
}

export function computeStandings(teams: Team[], matches: Match[]): StandingRow[] {
  type Acc = StandingRow & { runsFor: number; ballsFaced: number; runsAgainst: number; ballsBowled: number }
  const table = new Map<string, Acc>()
  teams.forEach(team =>
    table.set(team.name, {
      team, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, nrr: 0, form: [],
      runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0
    })
  )

  const done = matches
    .filter(m => m.status === 'Completed' && m.resultType)
    .sort((a, b) => a.matchNumber - b.matchNumber)

  for (const m of done) {
    const a = table.get(m.teamA)
    const b = table.get(m.teamB)
    if (!a || !b) continue
    a.played++
    b.played++

    if (m.resultType === 'no-result') {
      a.noResult++; b.noResult++
      a.points += NO_RESULT_POINTS; b.points += NO_RESULT_POINTS
      a.form.push('N'); b.form.push('N')
      continue // abandoned matches never count towards NRR
    }

    if (m.resultType === 'tie') {
      a.tied++; b.tied++
      a.points += TIE_POINTS; b.points += TIE_POINTS
      a.form.push('T'); b.form.push('T')
    } else {
      const [win, lose] = m.winner === m.teamA ? [a, b] : [b, a]
      win.won++; lose.lost++
      win.points += WIN_POINTS
      win.form.push('W'); lose.form.push('L')
    }

    if (m.scoreA && m.scoreB && m.oversLimit) {
      const ballsA = chargedBalls(m.scoreA, m.oversLimit)
      const ballsB = chargedBalls(m.scoreB, m.oversLimit)
      a.runsFor += m.scoreA.runs; a.ballsFaced += ballsA
      a.runsAgainst += m.scoreB.runs; a.ballsBowled += ballsB
      b.runsFor += m.scoreB.runs; b.ballsFaced += ballsB
      b.runsAgainst += m.scoreA.runs; b.ballsBowled += ballsA
    }
  }

  const rows: StandingRow[] = []
  table.forEach(acc => {
    const forRate = acc.ballsFaced ? (acc.runsFor / acc.ballsFaced) * 6 : 0
    const againstRate = acc.ballsBowled ? (acc.runsAgainst / acc.ballsBowled) * 6 : 0
    const { runsFor, ballsFaced, runsAgainst, ballsBowled, ...row } = acc
    rows.push({ ...row, nrr: forRate - againstRate })
  })

  // Real-league ordering: points, then net run rate, then wins, then name
  return rows.sort(
    (x, y) =>
      y.points - x.points ||
      y.nrr - x.nrr ||
      y.won - x.won ||
      x.team.name.localeCompare(y.team.name)
  )
}
