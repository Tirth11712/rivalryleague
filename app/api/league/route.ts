import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { readDb, writeDb } from '@/lib/server/db'

export async function GET() {
  try {
    const db = await readDb()
    return NextResponse.json({
      success: true,
      league: db.league,
      teamsCount: db.teams.length,
      playersCount: db.players.length,
      soldCount: db.players.filter(p => p.status === 'Sold').length,
      upcomingCount: db.players.filter(p => p.status === 'Upcoming').length
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function PUT(req: Request) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const body = await req.json()
    const db = await readDb()

    db.league = {
      ...db.league,
      name: body.name || db.league.name,
      season: body.season || db.league.season,
      defaultPurse: Number(body.defaultPurse) || db.league.defaultPurse,
      maxSquadSize: Number(body.maxSquadSize) || db.league.maxSquadSize
    }

    await writeDb(db)
    return NextResponse.json({ success: true, league: db.league })
  } catch (err) {
    return serverError(err)
  }
}

