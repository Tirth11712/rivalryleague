import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import {
  getAllMatches,
  createMatch,
  deleteMatch,
  generateRoundRobinSchedule
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
      const result = await generateRoundRobinSchedule()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    const result = await createMatch(body)
    const matches = await getAllMatches()
    return NextResponse.json({ ...result, matches }, { status: result.success ? 200 : 400 })
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
    const matches = await getAllMatches()
    return NextResponse.json({ ...result, matches }, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}
