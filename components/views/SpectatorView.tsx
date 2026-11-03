'use client'

import { Lock, Gavel } from 'lucide-react'
import type { Player, Team } from '@/lib/server/db'
import { TeamBadge } from '@/components/common/TeamBadge'
import { LiveSpinWheel } from '@/components/common/SpinWheel'
import type { ScheduledSpin } from '@/lib/client/api'
import { BID_STEPS, maxBidFor } from '@/lib/shared/rules'

/** Read-only live auction for viewers; a signed-in owner also gets bid buttons for their team. */
export function SpectatorView({
  players,
  teams,
  current,
  bid,
  minRaise,
  leader,
  liveSpin,
  maxSquadSize,
  ownerTeam,
  onOwnerBid,
  onUnlock
}: {
  players: Player[]
  teams: Team[]
  current: Player | null
  bid: number
  minRaise: number
  leader: Team | null
  liveSpin: ScheduledSpin | null
  maxSquadSize: number
  ownerTeam: Team | null
  onOwnerBid: (increment: number) => void
  onUnlock: () => void
}) {
  const upcoming = players.filter(p => p.status === 'Upcoming').length
  const unsold = players.filter(p => p.status === 'Unsold').length
  const sold = players.filter(p => p.status === 'Sold').length
  const squadFull = !!ownerTeam && ownerTeam.players >= maxSquadSize
  const isLeading = !!ownerTeam && leader?.id === ownerTeam.id
  const maxBid = ownerTeam ? maxBidFor(ownerTeam, maxSquadSize) : 0
  const mySquad = ownerTeam ? players.filter(p => p.status === 'Sold' && p.soldTo === ownerTeam.name) : []

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="section-kicker">
            <span className="live-dot" /> Live auction{ownerTeam ? ` · ${ownerTeam.name}` : ''}
          </span>
          <h2>On the <em>block</em></h2>
        </div>
        {!ownerTeam && (
          <button className="ghost-btn btn-sm" onClick={onUnlock}>
            <Lock size={14} /> Sign in
          </button>
        )}
      </div>

      <section className="spectator-stage">
        {liveSpin ? (
          <div className="spectator-spin">
            <LiveSpinWheel key={liveSpin.id} spin={liveSpin} players={players} />
            <p>Drawing the next player…</p>
          </div>
        ) : current ? (
          <>
            <span className="spectator-num">PLAYER #{current.number}</span>
            <h3 className="spectator-name">{current.name}</h3>
            <div className="spectator-bid">
              <small>CURRENT BID</small>
              <b>₹{bid.toLocaleString()}</b>
            </div>
            <p className="spectator-leader">
              {leader ? (
                <>Leading: <span className="team-dot" style={{ background: leader.color }} /> <b>{leader.name}</b></>
              ) : (
                <>Base price ₹{(current.base || 500).toLocaleString()} · no bids yet</>
              )}
            </p>
          </>
        ) : (
          <div className="spectator-idle">
            <Gavel size={34} />
            <p>
              {players.length === 0
                ? 'No players registered yet.'
                : upcoming + unsold === 0
                ? 'Auction complete - see Schedule → Results for the final squads.'
                : 'Waiting for the next player to be drawn…'}
            </p>
          </div>
        )}
        <div className="spectator-counts">
          <span><b>{upcoming}</b> upcoming</span>
          <span><b>{sold}</b> sold</span>
          <span><b>{unsold}</b> unsold</span>
        </div>
      </section>

      {ownerTeam && (
        <section className="card card-pad" style={{ marginTop: 14 }}>
          <div className="card-label" style={{ alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamBadge team={ownerTeam} size={28} /> Bid for {ownerTeam.name}
            </span>
            <b>Max bid ₹{maxBid.toLocaleString()} · {ownerTeam.players}/{maxSquadSize}</b>
          </div>
          {current && minRaise > BID_STEPS[0] && (
            <p className="min-raise">Minimum raise now ₹{minRaise.toLocaleString()}</p>
          )}
          <div className="inc-grid">
            {BID_STEPS.map((inc, i) => (
              <button
                key={inc}
                className={`inc-btn ${i === 3 ? 'hot' : i ? 'mid' : ''}`}
                onClick={() => onOwnerBid(inc)}
                disabled={!current || squadFull || isLeading || inc < minRaise || maxBid < bid + inc}
              >
                <b>+₹{inc.toLocaleString()}</b>
                <small>Bid ₹{(bid + inc).toLocaleString()}</small>
              </button>
            ))}
          </div>
          {(isLeading || squadFull) && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
              {squadFull ? 'Your squad is full.' : 'You hold the top bid.'}
            </p>
          )}
        </section>
      )}

      {ownerTeam && (
        <section className="card card-pad my-squad" style={{ marginTop: 14 }}>
          <div className="card-label">
            <span>My squad</span>
            <b>{mySquad.length}/{maxSquadSize} · ₹{ownerTeam.purse.toLocaleString()} left</b>
          </div>
          {mySquad.length === 0 ? (
            <p className="my-squad-empty">Players you buy will appear here.</p>
          ) : (
            <ul>
              {mySquad.map(p => (
                <li key={p.id}>
                  <span className="my-squad-num">#{p.number}</span>
                  <b className="my-squad-name">{p.name}</b>
                  <b className="my-squad-price">₹{(p.soldPrice || 0).toLocaleString()}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="spectator-teams">
        {teams.map(t => (
          <div
            key={t.id}
            className={leader?.id === t.id ? 'spectator-team leading' : 'spectator-team'}
            style={{ borderLeftColor: t.color }}
          >
            <b>{t.name}</b>
            <span>₹{t.purse.toLocaleString()} left</span>
            <small>{t.players}/{maxSquadSize} players</small>
          </div>
        ))}
      </section>
    </div>
  )
}
