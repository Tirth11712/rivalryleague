import { readDb, writeDb, DatabaseSchema, Team } from '../db'
import { hashPassword, passwordMatches } from '../auth/password'

// Resized in the browser to 256x256, so a real logo is far below this.
const MAX_LOGO_CHARS = 150_000
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const MIN_PASSWORD_LENGTH = 6

/** Teams are referenced by name, so a rename has to reach every place that stores it. */
function renameTeam(db: DatabaseSchema, team: Team, name: string) {
  const oldName = team.name
  const swap = (value?: string) => (value === oldName ? name : value)

  db.players.forEach(p => {
    p.soldTo = swap(p.soldTo)
  })
  db.matches.forEach(m => {
    if (m.teamA !== oldName && m.teamB !== oldName) return
    m.teamA = swap(m.teamA) as string
    m.teamB = swap(m.teamB) as string
    m.tossWinner = swap(m.tossWinner)
    m.winner = swap(m.winner)
    m.result = m.result?.split(oldName).join(name)
  })
  if (db.auctionState.leaderTeamName === oldName) db.auctionState.leaderTeamName = name
  team.name = name
}

/**
 * Superadmin sets a team's name, owner and login. A blank password keeps the
 * existing one, so correcting a name does not lock the owner out.
 */
export async function setOwnerLogin(
  teamId: string,
  details: { teamName?: string; ownerName?: string; loginId: string; password?: string }
): Promise<{ success: boolean; message: string }> {
  const id = (details.loginId || '').trim().toLowerCase()
  const password = (details.password || '').trim()
  const teamName = details.teamName?.trim()
  if (details.teamName !== undefined && !teamName) return { success: false, message: 'Team name is required' }
  if (id.length < 3) return { success: false, message: 'Login ID must be at least 3 characters' }
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }

  const db = await readDb()
  const team = db.teams.find(t => t.id === teamId)
  if (!team) return { success: false, message: 'Team not found' }

  const taken = Object.entries(db.ownerLogins || {}).some(
    ([otherTeam, login]) => otherTeam !== teamId && login.loginId === id
  )
  if (taken) return { success: false, message: 'That login ID is already used by another team' }

  const existingHash = db.ownerLogins?.[team.id]?.pinHash
  if (!password && !existingHash) return { success: false, message: 'Enter a password for this owner' }

  if (teamName && teamName !== team.name) {
    const clash = db.teams.some(t => t.id !== team.id && t.name.toLowerCase() === teamName.toLowerCase())
    if (clash) return { success: false, message: 'Another team already has that name' }
    renameTeam(db, team, teamName)
  }

  const pinHash = password ? hashPassword(password) : (existingHash as string)
  db.ownerLogins = { ...db.ownerLogins, [team.id]: { loginId: id, pinHash } }
  if (details.ownerName?.trim()) team.owner = details.ownerName.trim()
  await writeDb(db)
  return { success: true, message: `Login saved for ${team.name}` }
}

export async function getOwnerLoginId(teamId: string): Promise<string> {
  const db = await readDb()
  return db.ownerLogins?.[teamId]?.loginId || ''
}

export async function verifyOwnerLogin(loginId: string, pin: string): Promise<Team | null> {
  const id = (loginId || '').trim().toLowerCase()
  const db = await readDb()
  const entry = Object.entries(db.ownerLogins || {}).find(([, login]) => login.loginId === id)
  if (!entry) return null
  const [teamId, login] = entry
  if (!passwordMatches((pin || '').trim(), login.pinHash)) return null
  return db.teams.find(t => t.id === teamId) || null
}

export async function setTeamLogo(
  teamId: string,
  logo: string | null
): Promise<{ success: boolean; message: string }> {
  if (logo !== null) {
    if (typeof logo !== 'string' || !LOGO_PATTERN.test(logo)) {
      return { success: false, message: 'Logo must be a PNG, JPEG or WebP image' }
    }
    if (logo.length > MAX_LOGO_CHARS) {
      return { success: false, message: 'Logo is too large' }
    }
  }

  const db = await readDb()
  const team = db.teams.find(t => t.id === teamId)
  if (!team) return { success: false, message: 'Team not found' }

  if (logo) team.logo = logo
  else delete team.logo

  await writeDb(db)
  return { success: true, message: logo ? 'Team logo updated' : 'Team logo removed' }
}
