import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { getOwnerTeamId, requireAuth } from '@/lib/server/auth/token'
import {
  getAuctionSnapshot,
  spinWheel,
  nominatePlayer,
  placeBid,
  sellPlayer,
  markUnsold,
  resetAuction,
  reopenAllUnsold
} from '@/lib/server/services/auctionService'

export async function GET() {
  try {
    const data = await getAuctionSnapshot()
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    return serverError(err)
  }
}

const OWNER_INCREMENTS = [100, 250, 500, 1000]

export async function POST(req: Request) {
  try {
    const { action, playerId, teamName, amount, increment, price, scope, seenBid } = await req.json()

    // Team owners may only bid, and only for their own team
    const ownerTeamId = getOwnerTeamId(req)
    if (ownerTeamId && action === 'bid') {
      if (!OWNER_INCREMENTS.includes(Number(increment))) {
        return NextResponse.json({ success: false, message: 'Invalid bid increment' }, { status: 400 })
      }
      const result = await placeBid(ownerTeamId, 0, Number(increment))
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    const denied = requireAuth(req)
    if (denied) return denied

    if (action === 'spin') {
      const allowed = ['auto', 'upcoming', 'unsold', 'all']
      const result = await spinWheel(allowed.includes(scope) ? scope : 'auto')
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'nominate') {
      const result = await nominatePlayer(Number(playerId))
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'bid') {
      const result = await placeBid(teamName, Number(amount))
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'sell') {
      const result = await sellPlayer(teamName, price, playerId, seenBid)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'unsold') {
      const result = await markUnsold()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'reopen-unsold') {
      const result = await reopenAllUnsold()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    if (action === 'reset') {
      const result = await resetAuction()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    return NextResponse.json({ success: false, message: 'Invalid auction action' }, { status: 400 })
  } catch (err) {
    return serverError(err)
  }
}
