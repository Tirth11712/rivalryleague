import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { readDb, writeDb } from '@/lib/server/db'
import { isLeagueMatch } from '@/lib/shared/playoffs'

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

    if (body.leagueMatches !== undefined) {
      const n = Math.floor(Number(body.leagueMatches))
      if (!Number.isFinite(n) || n < 1 || n > 200) {
        return NextResponse.json({ success: false, message: 'League matches must be between 1 and 200' }, { status: 400 })
      }
      const scheduled = db.matches.filter(isLeagueMatch).length
      if (n < scheduled) {
        return NextResponse.json(
          { success: false, message: `${scheduled} league matches are already scheduled - delete some first or choose ${scheduled} or more` },
          { status: 400 }
        )
      }
      db.league.leagueMatches = n
    }
    if (body.knockout !== undefined) {
      if (body.knockout !== 'semis' && body.knockout !== 'final') {
        return NextResponse.json({ success: false, message: 'Unknown knockout format' }, { status: 400 })
      }
      if (body.knockout !== (db.league.knockout || 'semis') && db.matches.some(m => !isLeagueMatch(m))) {
        return NextResponse.json(
          { success: false, message: 'Knockout matches already exist - delete them before changing the format' },
          { status: 400 }
        )
      }
      db.league.knockout = body.knockout
    }

    await writeDb(db)
    return reply({ success: true, league: db.league })
  } catch (err) {
    return serverError(err)
  }
}

