'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Shuffle } from 'lucide-react'
import type { Player } from '@/lib/server/db'
import type { ScheduledSpin } from '@/lib/client/api'

const WEDGE_COLORS = ['#6e472b', '#a9834a', '#543117', '#8c5e3c', '#3f2a1a', '#c5a880', '#725b38', '#94704a']
const UNSOLD_COLORS = ['#7a2e24', '#a8553f']

const CX = 160
const CY = 160
const R = 146
const EXTRA_TURNS = 6

function buildWedges(list: Player[], unsoldRound: boolean) {
  const n = list.length
  if (n === 0) return []
  const step = 360 / n
  const textRadius = n > 14 ? 112 : n > 8 ? 106 : 98

  return list.map((p, i) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const start = toRad(i * step - 90)
    const end = toRad((i + 1) * step - 90)
    const midDeg = (i + 0.5) * step - 90
    const mid = toRad(midDeg)
    const point = (rad: number, r: number) =>
      `${(CX + r * Math.cos(rad)).toFixed(2)} ${(CY + r * Math.sin(rad)).toFixed(2)}`

    return {
      id: p.id,
      number: p.number,
      color: unsoldRound ? UNSOLD_COLORS[i % 2] : WEDGE_COLORS[i % WEDGE_COLORS.length],
      path:
        n === 1
          ? `M ${CX} ${CY - R} A ${R} ${R} 0 1 0 ${CX} ${CY + R} A ${R} ${R} 0 1 0 ${CX} ${CY - R} Z`
          : `M ${CX} ${CY} L ${point(start, R)} A ${R} ${R} 0 ${step > 180 ? 1 : 0} 1 ${point(end, R)} Z`,
      tx: (CX + textRadius * Math.cos(mid)).toFixed(2),
      ty: (CY + textRadius * Math.sin(mid)).toFixed(2),
      rotate: (midDeg + 90).toFixed(2)
    }
  })
}

/** The angle that stops wedge `index` under the pointer at 12 o'clock. */
function stopAngle(index: number, count: number): number {
  return 360 - ((index + 0.5) * 360) / count
}

export function SpinWheel({
  players,
  unsoldRound,
  angle,
  spinning,
  durationMs,
  children
}: {
  players: Player[]
  unsoldRound: boolean
  angle: number
  spinning: boolean
  durationMs: number
  children: ReactNode
}) {
  const wedges = useMemo(() => buildWedges(players, unsoldRound), [players, unsoldRound])
  const n = players.length

  return (
    <div className={spinning ? 'spinner spinning' : 'spinner'}>
      <div
        className="spinner-svg-wrap"
        style={{
          transform: `rotate(${angle}deg)`,
          transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.12, 0.85, 0.22, 1)` : 'none'
        }}
      >
        <svg viewBox="0 0 320 320" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <defs>
            <linearGradient id="wheelRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e7cf9f" />
              <stop offset="50%" stopColor="#a9834a" />
              <stop offset="100%" stopColor="#c5a880" />
            </linearGradient>
          </defs>
          <circle cx={CX} cy={CY} r="158" fill="#2c241e" />
          {n === 0 ? (
            <circle cx={CX} cy={CY} r={R} fill="#ebe3d5" />
          ) : (
            wedges.map(w => (
              <g key={w.id}>
                <path d={w.path} fill={w.color} stroke="#2c241e" strokeWidth={n > 1 ? 1.2 : 0} />
                <text
                  x={w.tx}
                  y={w.ty}
                  transform={`rotate(${w.rotate}, ${w.tx}, ${w.ty})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontFamily="inherit"
                  fontWeight="700"
                  fontSize={n > 18 ? 10 : n > 12 ? 12 : n > 6 ? 14 : 16}
                >
                  #{w.number}
                </text>
              </g>
            ))
          )}
          <circle cx={CX} cy={CY} r="148" fill="none" stroke="url(#wheelRim)" strokeWidth="5" />
        </svg>
      </div>

      {children}
      <div className="pointer" />
    </div>
  )
}

/**
 * The one spin every screen plays, superadmin included. All wait for the scheduled start and turn
 * for the full time; a screen that picks it up late spins for only the time left.
 */
export function LiveSpinWheel({ spin, players }: { spin: ScheduledSpin; players: Player[] }) {
  const pool = useMemo(
    () => spin.poolIds.map(id => players.find(p => p.id === id)).filter((p): p is Player => !!p),
    [spin.poolIds, players]
  )
  const [angle, setAngle] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [started, setStarted] = useState(false)
  const count = spin.poolIds.length

  useEffect(() => {
    const target = EXTRA_TURNS * 360 + stopAngle(spin.landIndex, count)
    const elapsed = performance.now() - spin.startsAt
    const remaining = spin.durationMs - Math.max(0, elapsed)
    if (remaining < 400) {
      setStarted(true)
      setAngle(target) // caught the very end: show where it landed
      return
    }
    // Two frames so the wheel is painted at rest before it starts turning
    let outer = 0
    let inner = 0
    const timer = window.setTimeout(() => {
      outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => {
          setStarted(true)
          setDurationMs(remaining)
          setAngle(target)
        })
      })
    }, Math.max(0, -elapsed))
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each spin plays once
  }, [spin.id])

  return (
    <SpinWheel players={pool} unsoldRound={spin.unsoldRound} angle={angle} spinning={durationMs > 0} durationMs={durationMs}>
      <div className="spinner-center" style={{ cursor: 'default' }}>
        <Shuffle size={20} className="spin-icon-anim" />
        <small>{started ? 'DRAWING' : 'GET READY'}</small>
      </div>
    </SpinWheel>
  )
}
