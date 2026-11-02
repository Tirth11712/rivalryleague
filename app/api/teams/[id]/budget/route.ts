import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { adjustTeamBudget, getAllTeams } from '@/lib/server/services/teamService'

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
    const teams = await getAllTeams()
    return NextResponse.json({ ...result, teams }, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}
