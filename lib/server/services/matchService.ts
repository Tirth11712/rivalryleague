import { readDb, writeDb, Match, InningsScore } from '../db'
import { isLeagueMatch, LEAGUE_STAGE, oneMeetingOnly, playoffPhase, qualifiersFor, type KnockoutRound } from '@/lib/shared/playoffs'

export async function getAllMatches(): Promise<Match[]> {
  const db = await readDb()
  return db.matches
}

export async function createMatch(data: {
  teamA: string
  teamB: string
  date: string
  venue?: string
  stage?: string
}): Promise<{ success: boolean; match?: Match; message?: string }> {
  if (!data.teamA || !data.teamB) {
    return { success: false, message: 'Both Team A and Team B are required' }
  }
  if (data.teamA === data.teamB) {
    return { success: false, message: 'A team cannot play against itself' }
  }

  const db = await readDb()
  if (!db.teams.some(t => t.name === data.teamA) || !db.teams.some(t => t.name === data.teamB)) {
    return { success: false, message: 'Choose two registered teams' }
  }
  // Semi-finals and the final come from the points table, through createKnockouts
  if (!isLeagueMatch({ stage: (data.stage || '').trim() })) {
    return { success: false, message: 'Knockout matches are created from the points table once the league stage is over' }
  }
  const total = db.league.leagueMatches
  if (!total) {
    return { success: false, message: 'Set how many league matches the season has first (League Settings)' }
  }
  const leagueCount = db.matches.filter(isLeagueMatch).length
  if (leagueCount >= total) {
    return { success: false, message: `All ${total} league matches are already scheduled` }
  }
  if (db.matches.some(m => !isLeagueMatch(m))) {
    return { success: false, message: 'The knockouts have started - no more league matches can be added' }
  }
  if (oneMeetingOnly(db.league.knockout) && db.matches.some(m => isLeagueMatch(m) && samePair(m, data.teamA, data.teamB))) {
    return { success: false, message: `${data.teamA} and ${data.teamB} already meet in the league - each pair plays once in this format` }
  }

  const newMatch: Match = {
    id: newMatchId(db.matches),
    matchNumber: db.matches.length + 1,
    stage: LEAGUE_STAGE,
    teamA: data.teamA,
    teamB: data.teamB,
    date: data.date || new Date().toISOString().split('T')[0],
    venue: data.venue || 'Main Stadium Arena',
    status: 'Scheduled'
  }

  db.matches.push(newMatch)
  await writeDb(db)
  return { success: true, match: newMatch, message: `League match ${leagueCount + 1} of ${total} scheduled: ${data.teamA} vs ${data.teamB}` }
}

/**
 * Adds every league pairing not yet scheduled: each pair of teams once (single) or twice with
 * home and away swapped (double). Rounds follow the circle method so no team plays twice in a
 * round; each round gets the next day from the start date. The league match count grows to fit.
 */
export async function generateRoundRobin(input: {
  double?: boolean
  startDate?: string
  venue?: string
}): Promise<{ success: boolean; message: string }> {
  const db = await readDb()
  const names = db.teams.map(t => t.name)
  if (names.length < 2) return { success: false, message: 'Add at least two teams first' }
  if (input.double && oneMeetingOnly(db.league.knockout)) {
    return { success: false, message: 'Each pair plays once in the eliminator format - use a single round robin' }
  }
  if (db.matches.some(m => !isLeagueMatch(m))) {
    return { success: false, message: 'The knockouts have started - no more league matches can be added' }
  }

  // How often each pair already meets in the league
  const key = (a: string, b: string) => [a, b].sort().join('\u0000')
  const met = new Map<string, number>()
  for (const m of db.matches.filter(isLeagueMatch)) met.set(key(m.teamA, m.teamB), (met.get(key(m.teamA, m.teamB)) || 0) + 1)

  const ring: (string | null)[] = names.length % 2 ? [...names, null] : [...names]
  const rounds: [string, string][][] = []
  for (let r = 0; r < ring.length - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i], b = ring[ring.length - 1 - i]
      if (a && b) round.push(r % 2 ? [b, a] : [a, b]) // alternate who is listed first
    }
    rounds.push(round)
    ring.splice(1, 0, ring.pop() as string | null) // rotate everyone but the first
  }
  const legs = input.double ? [...rounds, ...rounds.map(rd => rd.map(([a, b]) => [b, a] as [string, string]))] : rounds

  const start = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate || '') ? new Date(`${input.startDate}T00:00:00Z`) : new Date()
  const venue = (input.venue || '').trim() || 'Main Stadium Arena'
  const target = input.double ? 2 : 1
  const used = new Map<string, number>()
  let added = 0
  let day = 0
  for (const round of legs) {
    let any = false
    for (const [a, b] of round) {
      const k = key(a, b)
      used.set(k, (used.get(k) || 0) + 1)
      if ((met.get(k) || 0) >= used.get(k)! || used.get(k)! > target) continue // already scheduled
      const date = new Date(start.getTime() + day * 86400000).toISOString().split('T')[0]
      db.matches.push({
        id: newMatchId(db.matches),
        matchNumber: db.matches.length + 1,
        stage: LEAGUE_STAGE,
        teamA: a,
        teamB: b,
        date,
        venue,
        status: 'Scheduled'
      })
      added++
      any = true
    }
    if (any) day++
  }

  if (added === 0) {
    return { success: false, message: `Every pair already plays ${target === 2 ? 'twice' : 'once'} - nothing to add` }
  }
  const leagueCount = db.matches.filter(isLeagueMatch).length
  const before = db.league.leagueMatches || 0
  db.league.leagueMatches = Math.max(before, leagueCount)
  await writeDb(db)
  const raised = before && db.league.leagueMatches > before ? ` · league matches raised from ${before} to ${db.league.leagueMatches}` : ''
  return {
    success: true,
    message: `Round robin: ${added} match${added === 1 ? '' : 'es'} added over ${day} day${day === 1 ? '' : 's'}${raised}`
  }
}

const samePair = (m: Pick<Match, 'teamA' | 'teamB'>, a: string, b: string) =>
  (m.teamA === a && m.teamB === b) || (m.teamA === b && m.teamB === a)

function newMatchId(existing: Match[]): string {
  let id = `m_${Date.now()}`
  for (let i = 2; existing.some(m => m.id === id); i++) id = `m_${Date.now()}_${i}`
  return id
}

/**
 * Creates the semi-finals, the eliminator or the final once the previous stage is complete. The pairings start
 * from the points table on the superadmin's screen; they may change who plays whom, but only
 * among teams that qualified.
 */
export async function createKnockouts(input: {
  round: KnockoutRound
  pairings: { teamA: string; teamB: string }[]
  date?: string
  venue?: string
}): Promise<{ success: boolean; message: string }> {
  const db = await readDb()
  const format = db.league.knockout || 'semis'
  const state = playoffPhase(db.teams, db.matches, db.league.leagueMatches, format)
  const wanted = `${input.round}-ready`
  if (state.phase !== wanted || !('pairings' in state)) {
    const why: Record<string, string> = {
      unset: 'Set how many league matches the season has first',
      league: 'Every league match needs a result first',
      semis: 'Both semi-finals need a result first',
      eliminator: 'The eliminator needs a result first',
      'eliminator-ready': 'The eliminator comes before the final',
      final: 'The final is already scheduled',
      done: 'The final has already been played',
      'too-few-teams': `This format needs at least ${qualifiersFor(format)} teams`,
      'semis-ready': 'The semi-finals come before the final',
      'final-ready': format === 'final' ? 'This league goes straight to the final' : format === 'eliminator' ? 'The eliminator is already scheduled' : 'The semi-finals are already scheduled'
    }
    return { success: false, message: why[state.phase] }
  }

  const expected = state.pairings
  const pairings = input.pairings || []
  if (pairings.length !== expected.length) {
    return { success: false, message: `Expected ${expected.length} match${expected.length === 1 ? '' : 'es'}` }
  }
  const qualified = new Set(expected.flatMap(p => [p.teamA, p.teamB]))
  const picked = pairings.flatMap(p => [p.teamA, p.teamB])
  if (new Set(picked).size !== picked.length || !picked.every(n => qualified.has(n))) {
    return { success: false, message: `Each qualified team plays once: ${[...qualified].join(', ')}` }
  }

  const date = input.date || new Date().toISOString().split('T')[0]
  const venue = (input.venue || '').trim() || 'Main Stadium Arena'
  pairings.forEach((p, i) => {
    db.matches.push({
      id: newMatchId(db.matches),
      matchNumber: db.matches.length + 1,
      stage: expected[i].stage,
      teamA: p.teamA,
      teamB: p.teamB,
      date,
      venue,
      status: 'Scheduled'
    })
  })
  await writeDb(db)
  const made = pairings.map((p, i) => `${expected[i].stage}: ${p.teamA} vs ${p.teamB}`).join(' · ')
  return { success: true, message: made }
}

export async function deleteMatch(id: string): Promise<{ success: boolean; message: string }> {
  const db = await readDb()
  db.matches = db.matches.filter(m => m.id !== id)
  db.matches.forEach((m, idx) => {
    m.matchNumber = idx + 1
  })
  await writeDb(db)
  return { success: true, message: 'Match deleted' }
}

export async function recordMatchResult(
  matchId: string,
  input: {
    oversLimit: number
    noResult?: boolean
    scoreA?: InningsScore
    scoreB?: InningsScore
  }
): Promise<{ success: boolean; match?: Match; message: string }> {
  const db = await readDb()
  const match = db.matches.find(m => m.id === matchId)
  if (!match) return { success: false, message: 'Match fixture not found' }

  if (input.noResult) {
    match.scoreA = undefined
    match.scoreB = undefined
    match.oversLimit = undefined
    match.winner = ''
    match.resultType = 'no-result'
    match.result = 'No result (abandoned)'
    match.status = 'Completed'
    await writeDb(db)
    return { success: true, match, message: 'Match recorded as No Result - 1 point each' }
  }

  const oversLimit = Math.floor(Number(input.oversLimit))
  if (!oversLimit || oversLimit < 1 || oversLimit > 50) {
    return { success: false, message: 'Overs per side must be between 1 and 50' }
  }

  const clean = (s?: InningsScore): InningsScore | null => {
    if (!s) return null
    const runs = Math.floor(Number(s.runs))
    const wickets = Math.floor(Number(s.wickets))
    const balls = Math.floor(Number(s.balls))
    if (![runs, wickets, balls].every(Number.isFinite) || runs < 0 || wickets < 0 || balls < 0) return null
    if (wickets > 10) return null
    if (balls > oversLimit * 6) return null
    return { runs, wickets, balls, allOut: !!s.allOut }
  }
  const scoreA = clean(input.scoreA)
  const scoreB = clean(input.scoreB)
  if (!scoreA || !scoreB) {
    return { success: false, message: 'Enter valid runs, wickets (10 at most) and overs (within the limit)' }
  }

  // Who batted first decides how the margin is described (runs vs wickets)
  const firstBatter =
    match.tossWinner && match.tossDecision === 'Bowl'
      ? (match.tossWinner === match.teamA ? match.teamB : match.teamA)
      : (match.tossWinner || match.teamA)
  const first = firstBatter === match.teamA ? scoreA : scoreB
  const second = firstBatter === match.teamA ? scoreB : scoreA
  const secondName = firstBatter === match.teamA ? match.teamB : match.teamA

  match.oversLimit = oversLimit
  match.scoreA = scoreA
  match.scoreB = scoreB

  if (scoreA.runs === scoreB.runs) {
    match.resultType = 'tie'
    match.winner = ''
    match.result = 'Match tied'
  } else {
    const winnerName = scoreA.runs > scoreB.runs ? match.teamA : match.teamB
    match.resultType = 'win'
    match.winner = winnerName
    if (winnerName === firstBatter) {
      const margin = first.runs - second.runs
      match.result = `${winnerName} won by ${margin} run${margin === 1 ? '' : 's'}`
    } else {
      const wicketsLeft = Math.max(0, Math.max(1, db.league.maxSquadSize - 1) - second.wickets)
      match.result = `${secondName} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`
    }
  }
  match.status = 'Completed'

  await writeDb(db)
  return { success: true, match, message: match.result as string }
}

export async function recordTossOutcome(
  matchId: string,
  tossWinner: string,
  tossDecision: 'Bat' | 'Bowl'
): Promise<{ success: boolean; match?: Match; message?: string }> {
  const db = await readDb()
  const match = db.matches.find(m => m.id === matchId)
  if (!match) {
    return { success: false, message: 'Match fixture not found' }
  }
  if (match.status === 'Completed') {
    return { success: false, message: 'This match is already completed' }
  }

  if (tossWinner !== match.teamA && tossWinner !== match.teamB) {
    return { success: false, message: 'Toss winner must be one of the participating teams' }
  }

  match.tossWinner = tossWinner
  match.tossDecision = tossDecision
  match.status = 'Toss Done'

  await writeDb(db)
  return {
    success: true,
    match,
    message: `Toss won by ${tossWinner}, elected to ${tossDecision} first!`
  }
}

