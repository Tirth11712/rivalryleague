import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { adjustTeamBudget } from '@/lib/server/services/teamService'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const { id } = await params
    const { mode, amount } = await req.json()
    const result = await adjustTeamBudget(id, mode || 'set', amount)
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
