'use client'

import { Trophy } from 'lucide-react'
import type { Celebration } from '@/lib/client/useLiveEvents'

const CONFETTI_PIECES = 14

/** A short win animation over the page. It never blocks a tap. */
export function WinBanner({ celebration }: { celebration: Celebration | null }) {
  if (!celebration) return null

  return (
    <div className="win-overlay" key={celebration.id} role="status" aria-live="polite">
      <div className="win-confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_PIECES }, (_, i) => <span key={i} />)}
      </div>
      <div className="win-card">
        <Trophy size={30} aria-hidden="true" />
        <small>{celebration.kicker}</small>
        <b>{celebration.title}</b>
        <span>{celebration.text}</span>
      </div>
    </div>
  )
}
