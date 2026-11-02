import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { verifyOwnerLogin } from '@/lib/server/services/ownerService'
import { issueToken } from '@/lib/server/auth/token'
import { attemptKey, clearFailures, isLocked, recordFailure, tooManyAttempts } from '@/lib/server/auth/loginGuard'

export async function POST(req: Request) {
  try {
    const { loginId, pin } = await req.json()
    const id = String(loginId ?? '').trim().toLowerCase()

    const key = attemptKey(`owner:${id}`, req)
    if (await isLocked(key)) return tooManyAttempts()

    const team = await verifyOwnerLogin(id, String(pin ?? ''))
    if (!team) {
      await recordFailure(key)
      return NextResponse.json({ success: false, message: 'Wrong login ID or password' }, { status: 401 })
    }
    await clearFailures(key)

    const issued = issueToken('owner', team.id)
    if (!issued) {
      return NextResponse.json(
        { success: false, message: 'Server auth is not configured (AUTH_SECRET)' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, teamId: team.id, ...issued })
  } catch (err) {
    return serverError(err)
  }
}
