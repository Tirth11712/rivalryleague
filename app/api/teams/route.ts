import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { getAllTeams, createTeam, deleteTeam } from '@/lib/server/services/teamService'
import { getAllPlayers } from '@/lib/server/services/playerService'

export async function GET() {
  try {
    const teams = await getAllTeams()
    return NextResponse.json({ success: true, teams })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const result = await createTeam(body)
    const teams = await getAllTeams()
    return NextResponse.json({ ...result, teams }, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, message: 'Team id is required' }, { status: 400 })
    }
    const result = await deleteTeam(id)
    const teams = await getAllTeams()
    const players = await getAllPlayers()
    return NextResponse.json({ ...result, teams, players }, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}
