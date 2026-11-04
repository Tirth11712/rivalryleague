import { NextResponse } from 'next/server'
import { DbConflictError, readDb } from './db'
import { buildClientState } from './clientState'

/** The JSON every API route returns when something throws, so the UI always has a reason to show. */
export function serverError(err: unknown): NextResponse {
  console.error('[api] request failed:', err)
  const conflict = err instanceof DbConflictError
  const message = conflict ? (err as Error).message : 'That did not go through - please try again'
  return NextResponse.json({ success: false, message }, { status: conflict ? 409 : 500 })
}

/**
 * Answers a change with its result plus the fresh state of the whole league, so the screen
 * updates straight away instead of asking again. The read is next to the database, so it is quick.
 */
export async function reply(result: { success: boolean } & Record<string, unknown>, status?: number): Promise<NextResponse> {
  // Lists are replaced by the state, which also turns logos into cacheable links
  const { teams: _teams, players: _players, matches: _matches, ...rest } = result
  const state = buildClientState(await readDb())
  return NextResponse.json({ ...rest, state }, { status: status ?? (result.success ? 200 : 400) })
}
