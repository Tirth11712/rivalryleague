import { readDb, writeDb, Match, InningsScore } from '../db'

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
  const newMatch: Match = {
    id: `m_${Date.now()}`,
    matchNumber: db.matches.length + 1,
    stage: data.stage || 'League Match',
    teamA: data.teamA,
    teamB: data.teamB,
    date: data.date || new Date().toISOString().split('T')[0],
    venue: data.venue || 'Main Stadium Arena',
    status: 'Scheduled'
  }

  db.matches.push(newMatch)
  await writeDb(db)
  return { success: true, match: newMatch }
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

export async function generateRoundRobinSchedule(): Promise<{
  success: boolean
  message: string
  matches: Match[]
}> {
  const db = await readDb()
  const teamNames = db.teams.map(t => t.name)
  if (teamNames.length < 2) {
    return { success: false, message: 'At least 2 teams are required to generate schedules', matches: [] }
  }

  const fixtures: Match[] = []
  let matchNum = 1
  const today = new Date()

  for (let i = 0; i < teamNames.length; i++) {
    for (let j = i + 1; j < teamNames.length; j++) {
      const matchDate = new Date(today)
      matchDate.setDate(today.getDate() + matchNum)
      fixtures.push({
        id: `m_${Date.now()}_${matchNum}`,
        matchNumber: matchNum,
        stage: `League Match #${matchNum}`,
        teamA: teamNames[i],
        teamB: teamNames[j],
        date: matchDate.toISOString().split('T')[0],
        venue: 'Grand Central Arena',
        status: 'Scheduled'
      })
      matchNum++
    }
  }

  db.matches = fixtures
  await writeDb(db)
  return {
    success: true,
    message: `Generated ${fixtures.length} tournament fixtures across ${teamNames.length} teams`,
    matches: fixtures
  }
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

