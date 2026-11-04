import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import {
  getAllPlayers,
  createPlayer,
  bulkImportPlayers,
  updatePlayer,
  deletePlayer
} from '@/lib/server/services/playerService'

export async function GET() {
  try {
    const players = await getAllPlayers()
    return NextResponse.json({ success: true, players })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const body = await req.json()

    if (body.bulk && Array.isArray(body.players)) {
      const result = await bulkImportPlayers(body.players)
      return reply(result)
    }

    const result = await createPlayer(body)
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}

export async function PUT(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json({ success: false, message: 'Player id is required' }, { status: 400 })
    }
    const result = await updatePlayer(Number(id), updates)
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
      return NextResponse.json({ success: false, message: 'Player id is required' }, { status: 400 })
    }
    const result = await deletePlayer(Number(id))
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
