import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { recordTossOutcome, getAllMatches } from '@/lib/server/services/matchService'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const { id } = await params
    const { tossWinner, tossDecision } = await req.json()
    const result = await recordTossOutcome(id, tossWinner, tossDecision)
    const matches = await getAllMatches()
    return NextResponse.json({ ...result, matches }, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}
