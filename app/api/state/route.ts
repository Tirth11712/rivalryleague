import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { readDb, readRevision } from '@/lib/server/db'
import { buildClientState, isUnchanged } from '@/lib/server/clientState'

const noStore = { 'Cache-Control': 'no-store' }

/** Everything a screen needs. Pass ?rev= from the last reply to get a tiny "unchanged" answer when nothing moved. */
export async function GET(req: Request) {
  try {
    const screenRev = Number(new URL(req.url).searchParams.get('rev'))
    if (Number.isInteger(screenRev) && screenRev > 0) {
      const { rev, spinStartedAt } = await readRevision()
      if (isUnchanged(rev, spinStartedAt, screenRev)) {
        return NextResponse.json({ success: true, unchanged: true, rev }, { headers: noStore })
      }
    }
    return NextResponse.json({ success: true, state: buildClientState(await readDb()) }, { headers: noStore })
  } catch (err) {
    return serverError(err)
  }
}
