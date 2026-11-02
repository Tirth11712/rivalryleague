'use client'

import { useEffect, useRef, useState } from 'react'
import type { Match, Player, Team } from '@/lib/server/db'
import type { ScheduledSpin } from './api'
import { sounds } from './sound'

export type Celebration = { id: number; kicker: string; title: string; text: string }

const CELEBRATION_MS = 3600

/**
 * Plays sounds and celebrations from changes in the live data, not from button presses, so
 * the superadmin, owners and viewers all hear and see the same events.
 */
export function useLiveEvents({
  players,
  matches,
  current,
  bid,
  leader,
  liveSpin
}: {
  players: Player[]
  matches: Match[]
  current: Player | null
  bid: number
  leader: Team | null
  liveSpin: ScheduledSpin | null
}): Celebration | null {
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const seenPlayers = useRef<Map<number, string> | null>(null)
  const seenMatches = useRef<Map<string, string> | null>(null)
  const seenBid = useRef('')
  const seenLot = useRef<number | null>(null)
  const seenSpin = useRef<number | null>(null)

  useEffect(() => {
    if (!liveSpin || liveSpin.id === seenSpin.current) return
    seenSpin.current = liveSpin.id
    sounds.playWheel(Math.max(0, liveSpin.startsAt - performance.now()), liveSpin.durationMs)
  }, [liveSpin])

  useEffect(() => {
    const lot = current?.id ?? null
    if (lot !== null && lot !== seenLot.current) sounds.playHammer()
    seenLot.current = lot
  }, [current])

  useEffect(() => {
    const key = `${current?.id}|${leader?.id}|${bid}`
    if (leader && key !== seenBid.current) sounds.playBid()
    seenBid.current = key
  }, [current, leader, bid])

  useEffect(() => {
    if (players.length === 0) return
    const before = seenPlayers.current
    seenPlayers.current = new Map(players.map(p => [p.id, `${p.status}|${p.soldTo}|${p.soldPrice}`]))
    if (!before) return // the first load is history, not news

    for (const p of players) {
      const was = before.get(p.id)
      if (was === undefined || was === seenPlayers.current.get(p.id)) continue
      if (p.status === 'Sold') {
        sounds.playSold()
        setCelebration({
          id: Date.now(),
          kicker: 'Sold',
          title: p.soldTo || '',
          text: `${p.name} · ₹${(p.soldPrice || 0).toLocaleString()}`
        })
      } else if (p.status === 'Unsold') {
        sounds.playUnsold()
      }
    }
  }, [players])

  useEffect(() => {
    if (matches.length === 0) return
    const before = seenMatches.current
    seenMatches.current = new Map(matches.map(m => [m.id, `${m.status}|${m.winner}|${m.result}`]))
    if (!before) return

    for (const m of matches) {
      const was = before.get(m.id)
      if (was === undefined || was === seenMatches.current.get(m.id) || !m.winner) continue
      sounds.playVictory()
      setCelebration({ id: Date.now(), kicker: 'Match won', title: m.winner, text: m.result || '' })
    }
  }, [matches])

  useEffect(() => {
    if (!celebration) return
    const id = window.setTimeout(() => setCelebration(null), CELEBRATION_MS)
    return () => window.clearTimeout(id)
  }, [celebration])

  return celebration
}
