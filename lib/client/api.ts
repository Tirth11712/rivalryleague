import type { Player, Team, Match, AuctionState } from '@/lib/server/db'

// Auctioneer token (issued by /api/auth after a correct PIN, valid ~12h)
const TOKEN_KEY = 'trl_auctioneer_token'
const OWNER_TOKEN_KEY = 'trl_owner_token'

function readToken(key: string): { raw: string; claims: { exp: number; teamId?: string } } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const base64 = raw.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(base64))
    if (typeof claims.exp !== 'number' || claims.exp <= Date.now()) {
      localStorage.removeItem(key)
      return null
    }
    return { raw, claims }
  } catch {
    return null
  }
}

function writeToken(key: string, token: string | null) {
  try {
    if (token) localStorage.setItem(key, token)
    else localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

export function getAuthToken(): string | null {
  return readToken(TOKEN_KEY)?.raw ?? null
}

export function setAuthToken(token: string | null) {
  writeToken(TOKEN_KEY, token)
}

/** Team id of the signed-in owner on this device, if any. */
export function getOwnerTeamId(): string | null {
  return readToken(OWNER_TOKEN_KEY)?.claims.teamId ?? null
}

export function setOwnerToken(token: string | null) {
  writeToken(OWNER_TOKEN_KEY, token)
}

// API Client Helper
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // Logo routes only accept the owner token; otherwise prefer the superadmin one
  const ownerToken = readToken(OWNER_TOKEN_KEY)?.raw ?? null
  const adminToken = url.endsWith('/logo') ? null : getAuthToken()
  const token = adminToken ?? ownerToken
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  if (res.status === 401 && token && !url.startsWith('/api/auth')) {
    // Token expired or revoked: drop it so the UI falls back to spectator mode
    if (adminToken) setAuthToken(null)
    else setOwnerToken(null)
    window.dispatchEvent(new Event('trl-auth-expired'))
  }
  const json = await res.json()
  return json as T
}

// 1. Auth API
export const apiAuth = {
  verifyPin: (pin: string) =>
    request<{ success: boolean; message?: string; token?: string; defaultPin?: boolean }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ pin })
    }),
  changePin: (currentPin: string, newPin: string) =>
    request<{ success: boolean; message: string }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ action: 'change-pin', currentPin, newPin })
    })
}

export type LiveSpin = {
  id: number
  poolIds: number[]
  landIndex: number
  unsoldRound: boolean
  elapsedMs: number // negative until the wheel starts turning
  durationMs: number
}

export type ScheduledSpin = LiveSpin & { startsAt: number }

const MAX_REPLY_DELAY_MS = 300

/**
 * Turns the server's timing into a start time on this device's clock. The reply's travel time is
 * about half the round trip, capped because a stalled request says nothing about the way back.
 */
export function scheduleSpin(spin: LiveSpin, sentAt: number): ScheduledSpin {
  const now = performance.now()
  const replyDelay = Math.min((now - sentAt) / 2, MAX_REPLY_DELAY_MS)
  return { ...spin, startsAt: now - replyDelay - spin.elapsedMs }
}

export type OwnerDetails = { teamName: string; ownerName: string; loginId: string; password: string }

export const apiOwner = {
  login: (loginId: string, pin: string) =>
    request<{ success: boolean; message?: string; token?: string; teamId?: string }>('/api/auth/owner', {
      method: 'POST',
      body: JSON.stringify({ loginId, pin })
    }),
  getLogin: (teamId: string) =>
    request<{ success: boolean; loginId: string }>(`/api/teams/${encodeURIComponent(teamId)}/owner-login`),
  setLogin: (teamId: string, details: OwnerDetails) =>
    request<{ success: boolean; message: string }>(`/api/teams/${encodeURIComponent(teamId)}/owner-login`, {
      method: 'POST',
      body: JSON.stringify(details)
    }),
  bid: (increment: number) =>
    request<{ success: boolean; message: string }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'bid', increment })
    }),
  uploadLogo: (teamId: string, logo: string) =>
    request<{ success: boolean; message: string }>(`/api/teams/${encodeURIComponent(teamId)}/logo`, {
      method: 'PUT',
      body: JSON.stringify({ logo })
    }),
  removeLogo: (teamId: string) =>
    request<{ success: boolean; message: string }>(`/api/teams/${encodeURIComponent(teamId)}/logo`, {
      method: 'DELETE'
    })
}

// 2. League API
export const apiLeague = {
  getSettings: () =>
    request<{ success: boolean; league: { name: string; season: string; defaultPurse: number; maxSquadSize: number } }>('/api/league'),
  updateSettings: (settings: { name?: string; season?: string; defaultPurse?: number; maxSquadSize?: number }) =>
    request<{ success: boolean; message: string; league: any }>('/api/league', {
      method: 'PUT',
      body: JSON.stringify(settings)
    })
}

// 3. Teams API
export const apiTeams = {
  create: (data: { name: string; short?: string; color?: string; owner?: string; purse?: number; tagline?: string }) =>
    request<{ success: boolean; team?: Team; teams: Team[]; message?: string }>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string; teams: Team[]; players: Player[] }>(`/api/teams?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  adjustBudget: (teamId: string, mode: 'set' | 'add' | 'subtract', amount: number) =>
    request<{ success: boolean; team?: Team; teams: Team[]; message: string }>(`/api/teams/${encodeURIComponent(teamId)}/budget`, {
      method: 'POST',
      body: JSON.stringify({ mode, amount })
    })
}

// 4. Players API
export const apiPlayers = {
  create: (data: { name: string; base?: number }) =>
    request<{ success: boolean; player?: Player; players: Player[]; message?: string }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ ...data, base: data.base || 500 })
    }),
  bulkImport: (players: Array<{ name: string; base?: number }>) =>
    request<{ success: boolean; message: string; players: Player[] }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ bulk: true, players })
    }),
  update: (id: number, data: Partial<Player>) =>
    request<{ success: boolean; player?: Player; players: Player[]; message?: string }>('/api/players', {
      method: 'PUT',
      body: JSON.stringify({ id, ...data })
    }),
  delete: (id: number) =>
    request<{ success: boolean; message: string; players: Player[] }>(`/api/players?id=${id}`, {
      method: 'DELETE'
    })
}

// 5. Auction API
export const apiAuction = {
  getState: () =>
    request<{
      success: boolean
      auctionState: AuctionState
      current: Player | null
      leader: Team | null
      teams: Team[]
      players: Player[]
      spin: LiveSpin | null
    }>('/api/auction'),
  spin: (scope: 'auto' | 'upcoming' | 'unsold' | 'all' = 'auto') =>
    request<{
      success: boolean
      player: Player
      auctionState: AuctionState
      message: string
      isUnsoldRound?: boolean
      spin: LiveSpin
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'spin', scope })
    }),
  nominate: (playerId: number) =>
    request<{
      success: boolean
      player: Player
      auctionState: AuctionState
      message: string
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'nominate', playerId })
    }),
  bid: (teamName: string, amount: number) =>
    request<{
      success: boolean
      auctionState: AuctionState
      message: string
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'bid', teamName, amount })
    }),
  sell: (teamName: string, price: number, playerId?: number, seenBid?: number) =>
    request<{
      success: boolean
      player: Player
      team: Team
      teams: Team[]
      players: Player[]
      auctionState: AuctionState
      message: string
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'sell', teamName, price, playerId, seenBid })
    }),
  unsold: () =>
    request<{
      success: boolean
      player: Player
      message: string
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'unsold' })
    }),
  reopenAllUnsold: () =>
    request<{
      success: boolean
      message: string
      players: Player[]
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'reopen-unsold' })
    }),
  reset: () =>
    request<{
      success: boolean
      message: string
      players: Player[]
      teams: Team[]
    }>('/api/auction', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' })
    })
}

// 6. Matches & Toss API
export const apiMatches = {
  getAll: () => request<{ success: boolean; matches: Match[] }>('/api/matches'),
  create: (data: { teamA: string; teamB: string; date: string; venue?: string; stage?: string }) =>
    request<{ success: boolean; match?: Match; matches: Match[]; message?: string }>('/api/matches', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    request<{ success: boolean; message: string; matches: Match[] }>(`/api/matches?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  generateRoundRobin: () =>
    request<{ success: boolean; message: string; matches: Match[] }>('/api/matches', {
      method: 'POST',
      body: JSON.stringify({ action: 'generate-round-robin' })
    }),
  recordResult: (
    matchId: string,
    data: {
      oversLimit: number
      noResult?: boolean
      scoreA?: { runs: number; wickets: number; balls: number; allOut: boolean }
      scoreB?: { runs: number; wickets: number; balls: number; allOut: boolean }
    }
  ) =>
    request<{ success: boolean; message: string; matches: Match[] }>(
      `/api/matches/${encodeURIComponent(matchId)}/result`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  recordToss: (matchId: string, tossWinner: string, tossDecision: 'Bat' | 'Bowl') =>
    request<{ success: boolean; match?: Match; matches: Match[]; message: string }>(`/api/matches/${encodeURIComponent(matchId)}/toss`, {
      method: 'POST',
      body: JSON.stringify({ tossWinner, tossDecision })
    })
}

