import fs from 'fs/promises'
import path from 'path'
import { neon } from '@neondatabase/serverless'

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
// Neon Serverless PostgreSQL Database Client
// -------------------------------------------------------------
let sqlClient: ReturnType<typeof neon> | null = null
let isNeonInitialized = false

export function getSqlClient() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return null
  if (!sqlClient) {
    sqlClient = neon(dbUrl)
  }
  return sqlClient
}

async function ensureNeonDb(sql: ReturnType<typeof neon>): Promise<void> {
  if (isNeonInitialized) return

  // Create persistence store table in Postgres
  await sql`
    CREATE TABLE IF NOT EXISTS auction_store (
      id VARCHAR(32) PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `

  // Check if initial row exists
  const rows = (await sql`
    SELECT id FROM auction_store WHERE id = 'default' LIMIT 1;
  `) as Array<Record<string, any>>

  if (rows.length === 0) {
    // Seed initial row from local auction-db.json if available
    let seedData = initialData
    try {
      const content = await fs.readFile(DB_FILE, 'utf-8')
      seedData = JSON.parse(content) as DatabaseSchema
    } catch {
      seedData = initialData
    }

    await sql`
      INSERT INTO auction_store (id, data, updated_at)
      VALUES ('default', ${JSON.stringify(seedData)}::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING;
    `
  }

  isNeonInitialized = true
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
      await ensureNeonDb(sql)
      const rows = (await sql`
        SELECT data FROM auction_store WHERE id = 'default' LIMIT 1;
      `) as Array<Record<string, any>>
      if (rows.length > 0 && rows[0].data) return rows[0].data as DatabaseSchema
    } catch (err) {
      if (process.env.VERCEL) throw err
      console.error('[Neon Postgres Read Warning, falling back to local file]:', err)
    }
  }
  return await ensureLocalDb()
}

export async function writeDb(data: DatabaseSchema): Promise<void> {
  const sql = getSqlClient()
  if (sql) {
    const baseRev = data.rev ?? 0
    data.rev = baseRev + 1
    try {
      await ensureNeonDb(sql)
      // Only applies if nobody else saved since this copy was read
      const rows = (await sql`
        UPDATE auction_store
        SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW()
        WHERE id = 'default' AND COALESCE((data->>'rev')::int, 0) = ${baseRev}
        RETURNING id;
      `) as Array<Record<string, any>>
      if (rows.length === 0) throw new DbConflictError()
      return
    } catch (err) {
      data.rev = baseRev
      if (err instanceof DbConflictError || process.env.VERCEL) throw err
      console.error('[Neon Postgres Write Warning, saving locally]:', err)
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
