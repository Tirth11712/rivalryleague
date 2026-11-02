import { readDb, writeDb, AuctionState, DatabaseSchema, DbConflictError, Player, Team } from '../db'
import { maxBidFor, WHEEL_LEAD_MS, WHEEL_REVEAL_PAUSE_MS, WHEEL_SPIN_MS } from '@/lib/shared/rules'

/** Gives a sold player's price and squad slot back to the team that bought them. */
function refundSale(db: DatabaseSchema, player: Player) {
  if (player.status !== 'Sold' || !player.soldTo) return
  const team = db.teams.find(t => t.name === player.soldTo)
  if (!team) return
  const price = player.soldPrice || 0
  team.purse += price
  team.spent = Math.max(0, team.spent - price)
  team.players = Math.max(0, team.players - 1)
}

export async function getAuctionSnapshot(): Promise<{
  auctionState: AuctionState
  current: Player | null
  leader: Team | null
  teams: Team[]
  players: Player[]
  spin: LiveSpin | null
}> {
  const db = await readDb()
  const { spin, ...state } = db.auctionState

  // While the wheel turns, nobody's screen shows who it will stop on
  if (spin && isSpinning(db.auctionState)) {
    return {
      auctionState: { ...state, currentPlayerId: null, currentBid: 0, leaderTeamId: null, leaderTeamName: null },
      current: null,
      leader: null,
      teams: db.teams,
      players: db.players,
      spin: toLiveSpin(spin)
    }
  }

  const current = db.players.find(p => p.id === state.currentPlayerId) || null
  const leader = db.teams.find(t => t.name === state.leaderTeamName) || null

  return { auctionState: state, current, leader, teams: db.teams, players: db.players, spin: null }
}

export type LiveSpin = {
  id: number
  poolIds: number[]
  landIndex: number
  unsoldRound: boolean
  elapsedMs: number // negative until the wheel starts turning
  durationMs: number
}

function toLiveSpin(spin: NonNullable<AuctionState['spin']>): LiveSpin {
  return {
    id: spin.startedAt,
    poolIds: spin.poolIds,
    landIndex: spin.landIndex,
    unsoldRound: spin.unsoldRound,
    elapsedMs: Date.now() - spin.startedAt,
    durationMs: WHEEL_SPIN_MS
  }
}

function isSpinning(state: AuctionState): boolean {
  return !!state.spin && Date.now() - state.spin.startedAt < WHEEL_SPIN_MS + WHEEL_REVEAL_PAUSE_MS
}

export type WheelScope = 'auto' | 'upcoming' | 'unsold' | 'all'

export async function spinWheel(scope: WheelScope = 'auto'): Promise<{
  success: boolean
  player?: Player
  auctionState?: AuctionState
  message: string
  isUnsoldRound?: boolean
  spin?: LiveSpin
}> {
  const db = await readDb()
  if (isSpinning(db.auctionState)) {
    return { success: false, message: 'The wheel is still spinning' }
  }
  const onBlock = db.players.find(p => p.id === db.auctionState.currentPlayerId)
  if (onBlock) {
    return { success: false, message: `Mark #${onBlock.number} (${onBlock.name}) sold or unsold before spinning again` }
  }

  const upcoming = db.players.filter(p => p.status === 'Upcoming')
  const unsold = db.players.filter(p => p.status === 'Unsold')

  let candidatePool = upcoming
  let isUnsoldRound = false

  if (scope === 'all') {
    candidatePool = db.players
  } else if (scope === 'unsold') {
    candidatePool = unsold
    isUnsoldRound = true
  } else if (scope === 'auto' && candidatePool.length === 0 && unsold.length > 0) {
    candidatePool = unsold
    isUnsoldRound = true
  }

  if (candidatePool.length === 0) {
    return {
      success: false,
      message:
        scope === 'all'
          ? 'No players registered yet.'
          : scope === 'unsold'
          ? 'No unsold players in the pool.'
          : 'All players processed! No upcoming or unsold players remaining in pool.'
    }
  }

  const randomPlayer = candidatePool[Math.floor(Math.random() * candidatePool.length)]
  const spin = {
    startedAt: Date.now() + WHEEL_LEAD_MS,
    poolIds: candidatePool.map(p => p.id),
    landIndex: candidatePool.indexOf(randomPlayer),
    unsoldRound: isUnsoldRound
  }
  db.auctionState = {
    currentPlayerId: randomPlayer.id,
    currentBid: randomPlayer.base || 500,
    leaderTeamId: null,
    leaderTeamName: null,
    lastUpdated: new Date().toISOString(),
    spin
  }

  await writeDb(db)
  return {
    spin: toLiveSpin(spin),
    success: true,
    message: isUnsoldRound
      ? `[RE-AUCTION ROUND] Unsold Player #${randomPlayer.number} (${randomPlayer.name}) drawn on the block!`
      : `Player #${randomPlayer.number} (${randomPlayer.name}) drawn by Auctioneer`,
    player: randomPlayer,
    auctionState: db.auctionState,
    isUnsoldRound
  }
}

export async function reopenAllUnsold(): Promise<{
  success: boolean
  message: string
  players: Player[]
}> {
  const db = await readDb()
  const unsold = db.players.filter(p => p.status === 'Unsold')
  if (!unsold.length) {
    return { success: false, message: 'No unsold players to restore', players: db.players }
  }

  unsold.forEach(p => {
    p.status = 'Upcoming'
  })

  await writeDb(db)
  return {
    success: true,
    message: `Restored ${unsold.length} unsold player(s) back into the upcoming pool`,
    players: db.players
  }
}

export async function nominatePlayer(playerId: number): Promise<{
  success: boolean
  player?: Player
  auctionState?: AuctionState
  message: string
}> {
  const db = await readDb()
  if (isSpinning(db.auctionState)) {
    return { success: false, message: 'The wheel is still spinning' }
  }
  const target = db.players.find(p => p.id === playerId)

  if (!target) {
    return { success: false, message: 'Player not found' }
  }

  db.auctionState = {
    currentPlayerId: target.id,
    currentBid: target.base || 500,
    leaderTeamId: null,
    leaderTeamName: null,
    lastUpdated: new Date().toISOString()
  }

  await writeDb(db)
  return {
    success: true,
    message: `Player #${target.number} (${target.name}) nominated by Auctioneer`,
    player: target,
    auctionState: db.auctionState
  }
}

type BidResult = { success: boolean; auctionState?: AuctionState; message: string }

/** Pass `increment` to bid relative to the live price, so a slightly stale screen still bids correctly. */
export async function placeBid(
  teamName: string,
  amount: number,
  increment?: number
): Promise<BidResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await tryBid(teamName, amount, increment)
    } catch (err) {
      if (!(err instanceof DbConflictError)) throw err
    }
  }
  return { success: false, message: 'Too many bids at once - please bid again' }
}

async function tryBid(teamName: string, amount: number, increment?: number): Promise<BidResult> {
  const db = await readDb()
  const current = db.players.find(p => p.id === db.auctionState.currentPlayerId)
  if (!current) {
    return { success: false, message: 'No player currently on auction' }
  }
  if (isSpinning(db.auctionState)) {
    return { success: false, message: 'The wheel is still spinning' }
  }

  const team = db.teams.find(t => t.name === teamName || t.id === teamName)
  if (!team) {
    return { success: false, message: 'Team not found' }
  }

  const maxSquad = db.league.maxSquadSize || 11
  if (team.players >= maxSquad) {
    return {
      success: false,
      message: `${team.name} has already reached the maximum squad limit of ${maxSquad} players`
    }
  }

  if (db.auctionState.leaderTeamId === team.id) {
    return { success: false, message: `${team.name} already holds the top bid` }
  }

  const bidAmount = increment ? (db.auctionState.currentBid || 0) + increment : Number(amount)
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    return { success: false, message: 'Please enter a valid bid amount' }
  }
  const currentBid = db.auctionState.currentBid || 0
  if (db.auctionState.leaderTeamId ? bidAmount <= currentBid : bidAmount < currentBid) {
    return {
      success: false,
      message: `Bid must be ${db.auctionState.leaderTeamId ? 'higher than' : 'at least'} ₹${currentBid.toLocaleString()}`
    }
  }
  if (bidAmount > team.purse) {
    return {
      success: false,
      message: `${team.name} has insufficient purse (₹${team.purse.toLocaleString()} available)`
    }
  }

  const maxBid = maxBidFor(team, maxSquad)
  if (bidAmount > maxBid) {
    return { success: false, message: `${team.name} can bid up to ₹${maxBid.toLocaleString()} and still fill its squad` }
  }

  db.auctionState.currentBid = bidAmount
  db.auctionState.leaderTeamId = team.id
  db.auctionState.leaderTeamName = team.name
  db.auctionState.lastUpdated = new Date().toISOString()

  await writeDb(db)
  return {
    success: true,
    message: `Bid of ₹${bidAmount.toLocaleString()} accepted for ${team.name}`,
    auctionState: db.auctionState
  }
}

export async function sellPlayer(
  teamName: string,
  price?: number,
  playerId?: number,
  seenBid?: number // the bid on the seller's screen, so a newer bid is never sold over
): Promise<{
  success: boolean
  player?: Player
  team?: Team
  teams?: Team[]
  players?: Player[]
  auctionState?: AuctionState
  message: string
}> {
  const db = await readDb()
  const targetPlayerId = playerId ? Number(playerId) : db.auctionState.currentPlayerId

  if (!targetPlayerId) {
    return { success: false, message: 'No player selected to sell' }
  }

  const targetPlayer = db.players.find(p => p.id === targetPlayerId)
  if (!targetPlayer) {
    return { success: false, message: 'Player not found' }
  }

  const live = targetPlayer.id === db.auctionState.currentPlayerId
  if (live && seenBid !== undefined && Number(seenBid) !== db.auctionState.currentBid) {
    return {
      success: false,
      message: `New bid: ₹${db.auctionState.currentBid.toLocaleString()} by ${db.auctionState.leaderTeamName || 'a team'}. Check it and sell again.`
    }
  }

  const winningTeamName = teamName || db.auctionState.leaderTeamName
  if (!winningTeamName) {
    return { success: false, message: 'Please select which team this player went into' }
  }

  const team = db.teams.find(t => t.name === winningTeamName || t.id === winningTeamName)
  if (!team) {
    return { success: false, message: 'Chosen team not found' }
  }

  const finalPrice = price !== undefined ? Number(price) : (db.auctionState.currentBid || targetPlayer.base || 500)
  if (finalPrice < 0 || isNaN(finalPrice)) {
    return { success: false, message: 'Please enter a valid sale price' }
  }

  // If re-selling a player, refund previous team
  refundSale(db, targetPlayer)

  const maxSquad = db.league.maxSquadSize || 11
  if (team.players >= maxSquad) {
    return {
      success: false,
      message: `${team.name} has reached maximum squad capacity (${maxSquad} players)`
    }
  }

  if (finalPrice > team.purse) {
    return {
      success: false,
      message: `${team.name} only has ₹${team.purse.toLocaleString()} purse available`
    }
  }

  const maxBid = maxBidFor(team, maxSquad)
  if (finalPrice > maxBid) {
    return { success: false, message: `${team.name} can pay up to ₹${maxBid.toLocaleString()} and still fill its squad` }
  }

  targetPlayer.status = 'Sold'
  targetPlayer.soldTo = team.name
  targetPlayer.soldPrice = finalPrice

  team.purse -= finalPrice
  team.spent += finalPrice
  team.players += 1

  if (db.auctionState.currentPlayerId === targetPlayer.id) {
    db.auctionState = {
      currentPlayerId: null,
      currentBid: 0,
      leaderTeamId: null,
      leaderTeamName: null,
      lastUpdated: new Date().toISOString()
    }
  }

  await writeDb(db)
  return {
    success: true,
    message: `HAMMER DOWN! Player #${targetPlayer.number} (${targetPlayer.name}) sold to ${team.name} for ₹${finalPrice.toLocaleString()}`,
    player: targetPlayer,
    team,
    teams: db.teams,
    players: db.players,
    auctionState: db.auctionState
  }
}

export async function markUnsold(): Promise<{
  success: boolean
  player?: Player
  message: string
}> {
  const db = await readDb()
  const current = db.players.find(p => p.id === db.auctionState.currentPlayerId)
  if (!current) {
    return { success: false, message: 'No player currently on auction to mark unsold' }
  }

  refundSale(db, current)
  current.status = 'Unsold'
  current.soldTo = undefined
  current.soldPrice = undefined

  db.auctionState = {
    currentPlayerId: null,
    currentBid: 0,
    leaderTeamId: null,
    leaderTeamName: null,
    lastUpdated: new Date().toISOString()
  }

  await writeDb(db)
  return {
    success: true,
    message: `Player #${current.number} (${current.name}) passed as UNSOLD`,
    player: current
  }
}

export async function resetAuction(): Promise<{
  success: boolean
  message: string
  players: Player[]
  teams: Team[]
}> {
  const db = await readDb()

  db.players.forEach(p => {
    p.status = 'Upcoming'
    p.soldTo = undefined
    p.soldPrice = undefined
  })

  db.teams.forEach(t => {
    t.purse += t.spent // gives back what was spent, so a team's own purse size survives
    t.spent = 0
    t.players = 0
  })

  db.auctionState = {
    currentPlayerId: null,
    currentBid: 0,
    leaderTeamId: null,
    leaderTeamName: null,
    lastUpdated: new Date().toISOString()
  }

  await writeDb(db)
  return {
    success: true,
    message: 'Auction reset — all players and purses restored to pristine state',
    players: db.players,
    teams: db.teams
  }
}

