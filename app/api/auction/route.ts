import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { BID_STEPS } from '@/lib/shared/rules'
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

export async function POST(req: Request) {
  try {
    const { action, playerId, teamName, amount, increment, price, scope, seenBid } = await req.json()

    // Team owners may only bid, and only for their own team
    const ownerTeamId = getOwnerTeamId(req)
    if (ownerTeamId && action === 'bid') {
      if (!(BID_STEPS as readonly number[]).includes(Number(increment))) {
        return NextResponse.json({ success: false, message: 'Invalid bid increment' }, { status: 400 })
      }
      const result = await placeBid(ownerTeamId, 0, Number(increment))
      return reply(result)
    }

    const denied = requireAuth(req)
    if (denied) return denied

    if (action === 'spin') {
      const allowed = ['auto', 'upcoming', 'unsold', 'all']
      const result = await spinWheel(allowed.includes(scope) ? scope : 'auto')
      return reply(result)
    }

    if (action === 'nominate') {
      const result = await nominatePlayer(Number(playerId))
      return reply(result)
    }

    if (action === 'bid') {
      const result = await placeBid(teamName, Number(amount))
      return reply(result)
    }

    if (action === 'sell') {
      const result = await sellPlayer(teamName, price, playerId, seenBid)
      return reply(result)
    }

    if (action === 'unsold') {
      const result = await markUnsold()
      return reply(result)
    }

    if (action === 'reopen-unsold') {
      const result = await reopenAllUnsold()
      return reply(result)
    }

    if (action === 'reset') {
      const result = await resetAuction()
      return reply(result)
    }

    return NextResponse.json({ success: false, message: 'Invalid auction action' }, { status: 400 })
  } catch (err) {
    return serverError(err)
  }
}
