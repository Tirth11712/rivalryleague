import { readDb, writeDb, Player, computeInitials } from '../db'

export async function getAllPlayers(): Promise<Player[]> {
  const db = await readDb()
  return db.players
}

export async function createPlayer(data: {
  name: string
  base?: number
}): Promise<{ success: boolean; player?: Player; message?: string }> {
  if (!data.name || !data.name.trim()) {
    return { success: false, message: 'Player name is required' }
  }

  const db = await readDb()
  const maxNum = db.players.reduce((max, p) => Math.max(max, p.number || 0), 0)
  const playerNumber = maxNum + 1

  const newPlayer: Player = {
    id: Date.now(),
    number: playerNumber,
    name: data.name.trim(),
    base: Number(data.base) || 500,
    status: 'Upcoming',
    initials: computeInitials(data.name)
  }

  db.players.push(newPlayer)
  await writeDb(db)
  return { success: true, player: newPlayer }
}

export async function bulkImportPlayers(
  list: Array<{ name: string; base?: number }>
): Promise<{ success: boolean; count: number; players: Player[] }> {
  const db = await readDb()
  let nextNum = db.players.reduce((max, p) => Math.max(max, p.number || 0), 0) + 1

  const added: Player[] = list.map((p, idx) => {
    const assignedNumber = nextNum++
    return {
      id: Date.now() + idx,
      number: assignedNumber,
      name: p.name?.trim() || `Player #${assignedNumber}`,
      base: Number(p.base) || 500,
      status: 'Upcoming',
      initials: computeInitials(p.name || 'PL')
    }
  })

  db.players.push(...added)
  await writeDb(db)
  return { success: true, count: added.length, players: db.players }
}

export async function updatePlayer(
  id: number,
  updates: Partial<Player>
): Promise<{ success: boolean; player?: Player; message?: string }> {
  const db = await readDb()
  const index = db.players.findIndex(p => p.id === id)
  if (index === -1) {
    return { success: false, message: 'Player not found' }
  }

  const current = db.players[index]
  const updatedName = updates.name !== undefined ? updates.name.trim() : current.name

  // If reopening a previously sold player, refund team and decrease squad count
  if (updates.status === 'Upcoming' && current.status === 'Sold' && current.soldTo) {
    const team = db.teams.find(t => t.name === current.soldTo)
    if (team) {
      team.purse += current.soldPrice || 0
      team.spent = Math.max(0, team.spent - (current.soldPrice || 0))
      team.players = Math.max(0, team.players - 1)
    }
    updates.soldTo = undefined
    updates.soldPrice = undefined
  }

  const updatedPlayer: Player = {
    ...current,
    ...updates,
    name: updatedName,
    initials: computeInitials(updatedName),
    number: current.number || index + 1
  }

  db.players[index] = updatedPlayer
  await writeDb(db)
  return { success: true, player: updatedPlayer }
}

export async function deletePlayer(id: number): Promise<{ success: boolean; message: string }> {
  const db = await readDb()
  const target = db.players.find(p => p.id === id)
  if (!target) {
    return { success: false, message: 'Player not found' }
  }

  // If sold, refund team
  if (target.status === 'Sold' && target.soldTo) {
    const team = db.teams.find(t => t.name === target.soldTo)
    if (team) {
      team.purse += target.soldPrice || 0
      team.spent = Math.max(0, team.spent - (target.soldPrice || 0))
      team.players = Math.max(0, team.players - 1)
    }
  }

  db.players = db.players.filter(p => p.id !== id)

  // If this was in spotlight, clear spotlight
  if (db.auctionState.currentPlayerId === id) {
    db.auctionState.currentPlayerId = null
    db.auctionState.currentBid = 0
    db.auctionState.leaderTeamId = null
    db.auctionState.leaderTeamName = null
    delete db.auctionState.spin
  }

  await writeDb(db)
  return { success: true, message: `Player "${target.name}" removed` }
}

