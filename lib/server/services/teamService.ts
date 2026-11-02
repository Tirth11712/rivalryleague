import { readDb, writeDb, Team } from '../db'

export async function getAllTeams(): Promise<Team[]> {
  const db = await readDb()
  return db.teams
}

export async function createTeam(data: {
  name: string
  short?: string
  color?: string
  owner?: string
  purse?: number
  tagline?: string
}): Promise<{ success: boolean; team?: Team; message?: string }> {
  if (!data.name || !data.name.trim()) {
    return { success: false, message: 'Team name is required' }
  }

  const db = await readDb()
  const exists = db.teams.some(t => t.name.toLowerCase() === data.name.trim().toLowerCase())
  if (exists) {
    return { success: false, message: 'A team with this name already exists' }
  }

  const defaultPurse = db.league?.defaultPurse || 20000
  const purse = data.purse !== undefined && data.purse > 0 ? Number(data.purse) : defaultPurse

  const newTeam: Team = {
    id: `team_${Date.now()}`,
    name: data.name.trim(),
    short: (data.short?.trim() || data.name.trim().slice(0, 2)).toUpperCase(),
    color: data.color || '#FACC15',
    owner: data.owner?.trim() || 'Franchise Owner',
    purse,
    spent: 0,
    players: 0,
    tagline: data.tagline?.trim() || 'Ready to compete'
  }

  db.teams.push(newTeam)
  await writeDb(db)
  return { success: true, team: newTeam }
}

export async function deleteTeam(id: string): Promise<{ success: boolean; message: string }> {
  const db = await readDb()
  const target = db.teams.find(t => t.id === id || t.name === id)
  if (!target) {
    return { success: false, message: 'Team not found' }
  }

  // Release any players sold to this team back to Unsold
  db.players.forEach(p => {
    if (p.soldTo === target.name) {
      p.status = 'Unsold'
      p.soldTo = undefined
      p.soldPrice = undefined
    }
  })

  // Clear from matches
  db.matches = db.matches.filter(m => m.teamA !== target.name && m.teamB !== target.name)

  // Clear if leader
  if (db.auctionState.leaderTeamName === target.name) {
    db.auctionState.leaderTeamId = null
    db.auctionState.leaderTeamName = null
  }

  db.teams = db.teams.filter(t => t.id !== target.id)
  if (db.ownerLogins) delete db.ownerLogins[target.id]
  await writeDb(db)
  return { success: true, message: `Team "${target.name}" and references deleted` }
}

export async function adjustTeamBudget(
  id: string,
  mode: 'set' | 'add' | 'subtract',
  amount: number
): Promise<{ success: boolean; team?: Team; message?: string }> {
  const db = await readDb()
  const team = db.teams.find(t => t.id === id || t.name === id)
  if (!team) {
    return { success: false, message: 'Team not found' }
  }

  const val = Number(amount)
  if (isNaN(val) || val < 0) {
    return { success: false, message: 'Please provide a valid non-negative amount' }
  }

  if (mode === 'set') {
    team.purse = val
  } else if (mode === 'add') {
    team.purse += val
  } else if (mode === 'subtract') {
    if (val > team.purse) {
      return { success: false, message: `Cannot subtract ₹${val}. Team only has ₹${team.purse}.` }
    }
    team.purse -= val
  }

  await writeDb(db)
  return {
    success: true,
    team,
    message: `Updated ${team.name} purse to ₹${team.purse.toLocaleString()}`
  }
}

