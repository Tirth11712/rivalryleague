import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import {
  getAllMatches,
  createMatch,
  createKnockouts,
  generateRoundRobin,
  deleteMatch
} from '@/lib/server/services/matchService'

export async function GET() {
  try {
    const matches = await getAllMatches()
    return NextResponse.json({ success: true, matches })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const body = await req.json()
    if (body.action === 'generate-round-robin') {
      return reply(await generateRoundRobin({ double: !!body.double, startDate: body.startDate, venue: body.venue }))
    }
    if (body.action === 'create-knockouts') {
      const round = body.round === 'final' ? 'final' : body.round === 'eliminator' ? 'eliminator' : 'semis'
      return reply(await createKnockouts({ round, pairings: body.pairings, date: body.date, venue: body.venue }))
    }
    const result = await createMatch(body)
    return reply(result)
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
      return NextResponse.json({ success: false, message: 'Match id is required' }, { status: 400 })
    }
    const result = await deleteMatch(id)
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
