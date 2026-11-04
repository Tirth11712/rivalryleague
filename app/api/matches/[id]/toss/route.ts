import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { recordTossOutcome } from '@/lib/server/services/matchService'

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
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
