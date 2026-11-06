import fs from 'fs/promises'
import path from 'path'
import postgres from 'postgres'

export type Player = {
  id: number
  number: number // Sequential player number (1, 2, 3...)
  name: string
  base: number
  status: 'Upcoming' | 'Sold' | 'Unsold'
  soldTo?: string
  soldPrice?: number
  initials: string
}

export type Team = {
  id: string
  name: string
  short: string
  color: string
  owner: string
  purse: number
  spent: number
  players: number
  tagline: string
  logo?: string // small data URL uploaded by the team owner
}

export type InningsScore = {
  runs: number
  wickets: number
  balls: number // legal balls faced (7.3 overs = 45)
  allOut: boolean
}

export type Match = {
  id: string
  matchNumber: number
  stage: string
  teamA: string
  teamB: string
  date: string
  venue: string
  status: 'Scheduled' | 'Toss Done' | 'Live' | 'Completed'
  tossWinner?: string
  tossDecision?: 'Bat' | 'Bowl'
  result?: string
  oversLimit?: number
  scoreA?: InningsScore
  scoreB?: InningsScore
  winner?: string // winning team name; empty for tie / no result
  resultType?: 'win' | 'tie' | 'no-result'
}

export type AuctionState = {
  currentPlayerId: number | null
  currentBid: number
  leaderTeamId: string | null
  leaderTeamName: string | null
  lastUpdated: string
  minRaise?: number // smallest raise still open for this player; starts at the smallest bid step
  spin?: { startedAt: number; poolIds: number[]; landIndex: number; unsoldRound: boolean } // the latest wheel draw
}

export type DatabaseSchema = {
  auctioneer: {
    pin?: string // only in older data; replaced by pinHash on the next sign-in
    pinHash?: string
    name: string
  }
  league: {
    name: string
    season: string
    defaultPurse: number
    maxSquadSize: number
    leagueMatches?: number | null // league-stage matches before the knockouts; unset until the superadmin chooses
    knockout?: 'semis' | 'final' | 'eliminator' // top 4 play semi-finals, top 2 go straight to the final, or 1st waits in the final for the 2nd v 3rd winner (default semis)
  }
  teams: Team[]
  players: Player[]
  matches: Match[]
  auctionState: AuctionState
  ownerLogins?: Record<string, { loginId: string; pinHash: string }> // keyed by team id, never sent to clients
  rev?: number // bumped on every write so concurrent writers cannot overwrite each other
}

/** Another request saved first. The caller should re-read and try again. */
export class DbConflictError extends Error {
  constructor() {
    super('The auction changed at the same moment - please try again')
  }
}

const DB_DIR = path.join(process.cwd(), 'data')
const DB_FILE = path.join(DB_DIR, 'auction-db.json')

const initialData: DatabaseSchema = {
  auctioneer: {
    pin: '1234',
    name: 'Chief Auctioneer'
  },
  league: {
    name: 'The Rivalry League',
    season: '01',
    defaultPurse: 20000,
    maxSquadSize: 5
  },
  teams: [],
  players: [],
  matches: [],
  auctionState: {
    currentPlayerId: null,
    currentBid: 0,
    leaderTeamId: null,
    leaderTeamName: null,
    lastUpdated: new Date().toISOString()
  }
}

// -------------------------------------------------------------
// Postgres (Supabase). Tables and the load_league / save_league
// functions come from supabase/schema.sql.
// -------------------------------------------------------------
type Sql = ReturnType<typeof postgres>
let sqlClient: Sql | null = null

export function getSqlClient(): Sql | null {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null
  if (!sqlClient) {
    sqlClient = postgres(dbUrl, {
      prepare: false, // required by Supabase's transaction pooler
      max: 1, // one connection per serverless instance
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl) ? false : 'require'
    })
  }
  return sqlClient
}

/** The whole league in one query, or null for a database with no league yet. */
async function loadFromPostgres(sql: Sql): Promise<DatabaseSchema | null> {
  const rows = await sql`select load_league() as data`
  return (rows[0]?.data as DatabaseSchema | null) ?? null
}

async function seedData(): Promise<DatabaseSchema> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, 'utf-8')) as DatabaseSchema
  } catch {
    return structuredClone(initialData)
  }
}

// -------------------------------------------------------------
// Local JSON File Fallback (for offline or local testing)
// -------------------------------------------------------------
/** A read can land in the middle of another request's save, so an unreadable file gets a few more tries. */
async function readLocalFile(): Promise<DatabaseSchema> {
  for (let attempt = 0; ; attempt++) {
    const content = await fs.readFile(DB_FILE, 'utf-8')
    try {
      return JSON.parse(content) as DatabaseSchema
    } catch (err) {
      if (attempt >= 20) throw err
      await new Promise(resolve => setTimeout(resolve, 25))
    }
  }
}

async function ensureLocalDb(): Promise<DatabaseSchema> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true })
    const parsed = await readLocalFile()
    let changed = false
    if (!parsed.matches) {
      parsed.matches = []
      changed = true
    }
    if (parsed.players && Array.isArray(parsed.players)) {
      parsed.players.forEach((p, idx) => {
        if (!p.number) {
          p.number = idx + 1
          changed = true
        }
      })
    }
    if (changed) {
      await fs.writeFile(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8')
    }
    return parsed
  } catch (err) {
    // Only a missing file starts fresh; anything else must never replace saved data
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    await fs.writeFile(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8')
    return initialData
  }
}

// -------------------------------------------------------------
// Core Database Read / Write Operations
// -------------------------------------------------------------
export async function readDb(): Promise<DatabaseSchema> {
  const sql = getSqlClient()
  if (sql) {
    try {
      // A new database starts from the starter data; its first save creates the league
      return (await loadFromPostgres(sql)) ?? { ...(await seedData()), rev: 0 }
    } catch (err) {
      if (process.env.VERCEL) throw err
      console.error('[Postgres read failed, falling back to local file]:', err)
    }
  }
  return await ensureLocalDb()
}

/** The save counter and latest spin start: one tiny query, so a screen with nothing new can skip the full load. */
export async function readRevision(): Promise<{ rev: number | null; spinStartedAt: number | null }> {
  const sql = getSqlClient()
  if (sql) {
    try {
      const rows = await sql`
        select l.rev, (a.spin->>'startedAt')::bigint as spin_at
        from league l left join auction_state a on a.id = 1
      `
      const row = rows[0]
      if (row) return { rev: Number(row.rev), spinStartedAt: row.spin_at == null ? null : Number(row.spin_at) }
    } catch (err) {
      if (process.env.VERCEL) throw err
    }
  }
  return { rev: null, spinStartedAt: null } // local file: always send everything
}

export async function writeDb(data: DatabaseSchema): Promise<void> {
  const sql = getSqlClient()
  if (sql) {
    const baseRev = data.rev ?? 0
    try {
      // Only applies if nobody else saved since this copy was read
      const rows = await sql`select save_league(${baseRev}, ${sql.json(data as never)}) as saved`
      if (!rows[0]?.saved) throw new DbConflictError()
      data.rev = baseRev + 1
      return
    } catch (err) {
      if (err instanceof DbConflictError || process.env.VERCEL) throw err
      console.error('[Postgres write failed, saving locally]:', err)
    }
  }

  // Local fallback
  await fs.mkdir(DB_DIR, { recursive: true })
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.trim().slice(0, 2).toUpperCase() || 'PL'
}
