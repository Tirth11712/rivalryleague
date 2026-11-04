import { readDb, writeDb, Player, computeInitials } from '../db'

export async function getAllPlayers(): Promise<Player[]> {
  const db = await readDb()
  return db.players
}

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/** Ids only ever go up, so players added in quick succession never share one. */
function idMaker(players: Player[]): () => number {
  let next = Math.max(Date.now(), players.reduce((max, p) => Math.max(max, p.id), 0) + 1)
  return () => next++
}

export async function createPlayer(data: {
  name: string
  base?: number
}): Promise<{ success: boolean; player?: Player; message?: string }> {
  const name = data.name?.trim().replace(/\s+/g, ' ')
  if (!name) {
    return { success: false, message: 'Player name is required' }
  }

  const db = await readDb()
  const existing = db.players.find(p => nameKey(p.name) === nameKey(name))
  if (existing) {
    return { success: false, message: `#${existing.number} ${existing.name} is already in the pool` }
  }
  const maxNum = db.players.reduce((max, p) => Math.max(max, p.number || 0), 0)

  const newPlayer: Player = {
    id: idMaker(db.players)(),
    number: maxNum + 1,
    name,
    base: Number(data.base) || 500,
    status: 'Upcoming',
    initials: computeInitials(name)
  }

  db.players.push(newPlayer)
  await writeDb(db)
  return { success: true, player: newPlayer }
}

/** Names already in the pool, or repeated in the list, are skipped, so sending the same list twice adds nothing twice. */
export async function bulkImportPlayers(
  list: Array<{ name: string; base?: number }>
): Promise<{ success: boolean; count: number; skipped: number; message: string; players: Player[] }> {
  const db = await readDb()
  let nextNum = db.players.reduce((max, p) => Math.max(max, p.number || 0), 0) + 1
  const nextId = idMaker(db.players)
  const seen = new Set(db.players.map(p => nameKey(p.name)))

  const added: Player[] = []
  for (const p of list) {
    const name = p.name?.trim().replace(/\s+/g, ' ')
    if (!name || seen.has(nameKey(name))) continue
    seen.add(nameKey(name))
    added.push({
      id: nextId(),
      number: nextNum++,
      name,
      base: Number(p.base) || 500,
      status: 'Upcoming',
      initials: computeInitials(name)
    })
  }
  const skipped = list.length - added.length

  if (added.length) {
    db.players.push(...added)
    await writeDb(db)
  }
  const message =
    `Added ${added.length} player${added.length === 1 ? '' : 's'}` +
    (skipped ? ` · ${skipped} already in the pool or repeated, skipped` : '')
  return { success: true, count: added.length, skipped, message, players: db.players }
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
    delete db.auctionState.minRaise
    delete db.auctionState.spin
  }

  await writeDb(db)
  return { success: true, message: `Player "${target.name}" removed` }
}

