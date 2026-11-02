import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000

type Role = 'auctioneer' | 'owner'
type Claims = { exp: number; role: Role; teamId?: string }

function getSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  // Dev convenience only; production must set AUTH_SECRET
  return process.env.NODE_ENV === 'production' ? null : 'dev-only-insecure-secret'
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function issueToken(
  role: Role = 'auctioneer',
  teamId?: string
): { token: string; expiresAt: number } | null {
  const secret = getSecret()
  if (!secret) return null
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const claims: Claims = { exp: expiresAt, role, ...(teamId ? { teamId } : {}) }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt }
}

function readClaims(req: Request): Claims | null {
  const secret = getSecret()
  if (!secret) return null
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null

  const a = Buffer.from(sig)
  const b = Buffer.from(sign(payload, secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Claims
    return typeof claims.exp === 'number' && claims.exp > Date.now() ? claims : null
  } catch {
    return null
  }
}

function deny(message: string): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 401 })
}

/** Returns a 401 response unless the request carries a valid auctioneer token. */
export function requireAuth(req: Request): NextResponse | null {
  return readClaims(req)?.role === 'auctioneer' ? null : deny('Auctioneer authorization required')
}

/** The team an owner token belongs to, or null for any other caller. */
export function getOwnerTeamId(req: Request): string | null {
  const claims = readClaims(req)
  return claims?.role === 'owner' && claims.teamId ? claims.teamId : null
}

/** Returns a 401 response unless the request carries the owner token of this exact team. */
export function requireTeamOwner(req: Request, teamId: string): NextResponse | null {
  const claims = readClaims(req)
  return claims?.role === 'owner' && claims.teamId === teamId
    ? null
    : deny('Team owner login required')
}
