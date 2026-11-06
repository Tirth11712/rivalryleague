'use client'

import { useRef, useState } from 'react'
import { Plus, Trash2, Users, Wallet, ArrowRight, Upload, KeyRound, ImageOff } from 'lucide-react'
import type { Team, Player } from '@/lib/server/db'
import { TeamBadge } from '@/components/common/TeamBadge'
import { fileToLogo } from '@/lib/client/image'
import { maxBidFor } from '@/lib/shared/rules'

function formatPurse(amount: number): string {
  return amount >= 1000 ? `₹${Math.round(amount / 1000)}K` : `₹${amount}`
}

export function TeamsView({
  teams,
  players,
  maxSquadSize,
  isAuctioneer,
  ownerTeamId,
  onAddTeam,
  onDeleteTeam,
  onAdjustBudget,
  onOwnerLogin,
  onUploadLogo,
  onRemoveLogo,
  notify
}: {
  teams: Team[]
  players: Player[]
  maxSquadSize: number
  isAuctioneer: boolean
  ownerTeamId: string | null
  onAddTeam: () => void
  onDeleteTeam: (name: string) => void
  onAdjustBudget: (t: Team) => void
  onOwnerLogin: (t: Team) => void
  onUploadLogo: (logo: string) => void
  onRemoveLogo: () => void
  notify: (message: string) => void
}) {
  const [teamFilter, setTeamFilter] = useState('ALL')
  const [openRosters, setOpenRosters] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const leaguePurse = teams.reduce((sum, t) => sum + t.purse + t.spent, 0)
  const visible = teamFilter === 'ALL' ? teams : teams.filter(t => t.id === teamFilter)

  const toggleRoster = (id: string) =>
    setOpenRosters(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      onUploadLogo(await fileToLogo(file))
    } catch (err) {
      notify((err as Error).message)
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Teams &amp; <em>rosters</em></h2>
        </div>
        {isAuctioneer && (
          <button className="primary-btn btn-sm" onClick={onAddTeam}><Plus size={14} /> Add Franchise</button>
        )}
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFile} />

      {teams.length === 0 ? (
        <div className="empty-state">
          <Users size={38} />
          <h3>No franchises registered</h3>
          <p>Create teams to begin allocating purse budgets and assembling rosters.</p>
          {isAuctioneer && (
            <button className="primary-btn" onClick={onAddTeam}><Plus size={16} /> Add First Franchise</button>
          )}
        </div>
      ) : (
        <>
          <div className="summary-strip">
            <div><b>{teams.length}</b><small>Franchises</small></div>
            <div><b>{formatPurse(leaguePurse)}</b><small>League purse</small></div>
            <div><b>{maxSquadSize}</b><small>Squad cap</small></div>
          </div>

          <div className="filter-row roles">
            <button className={teamFilter === 'ALL' ? 'filter-active' : ''} onClick={() => setTeamFilter('ALL')}>
              All Teams
            </button>
            {teams.map(t => (
              <button
                key={t.id}
                className={teamFilter === t.id ? 'filter-active' : ''}
                onClick={() => setTeamFilter(t.id)}
              >
                <span className="team-dot" style={{ background: t.color }} /> {t.name}
              </button>
            ))}
          </div>

          <div className="teams-grid">
            {visible.map(t => {
              const roster = players.filter(p => p.soldTo === t.name)
              const total = t.purse + t.spent
              const spentPct = total ? Math.round((t.spent / total) * 100) : 0
              const openSlots = Math.max(0, maxSquadSize - t.players)
              const maxBid = maxBidFor(t, maxSquadSize)
              const marquee = [...roster].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))[0]
              const isMine = ownerTeamId === t.id
              const rosterOpen = openRosters.includes(t.id)

              return (
                <article className="team-card" key={t.id}>
                  <div className="team-card-top">
                    <TeamBadge team={t} />
                    <div className="info">
                      <h3>{t.name}</h3>
                      <p>Owner: {t.owner}</p>
                    </div>
                    <span className={openSlots ? 'pill' : 'pill dark'}>{openSlots ? 'Active' : 'Full'}</span>
                  </div>

                  {isMine && (
                    <div className="team-actions">
                      <button className="primary-btn" onClick={() => fileInput.current?.click()}>
                        <Upload size={14} /> {t.logo ? 'Change logo' : 'Upload logo'}
                      </button>
                      <button className="ghost-btn" onClick={onRemoveLogo} disabled={!t.logo}>
                        <ImageOff size={14} /> Remove
                      </button>
                    </div>
                  )}

                  <div className="purse-box">
                    <div className="r">
                      <small>Remaining purse</small>
                      <span>
                        <b className="big">₹{t.purse.toLocaleString()}</b>
                        <span className="cap"> / ₹{total.toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="bar"><i style={{ width: `${100 - spentPct}%` }} /></div>
                    <div className="meta">
                      <span>Spent: ₹{t.spent.toLocaleString()} ({spentPct}%)</span>
                      <span>Max bid: ₹{maxBid.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="slots-row">
                    <span className="l"><Users size={16} /> {t.players} / {maxSquadSize} Players</span>
                    <span className="pill sand">{openSlots} open slots</span>
                  </div>

                  <div className="mix-grid">
                    <div className="mix-box">
                      <small>Marquee buy</small>
                      {marquee ? (
                        <>
                          <div className="pl">{marquee.name}</div>
                          <div className="pr">₹{(marquee.soldPrice || 0).toLocaleString()}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>None yet</span>
                      )}
                    </div>
                  </div>

                  {rosterOpen && (
                    <div className="roster-list">
                      {roster.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>No players acquired yet.</span>
                      ) : (
                        roster.map(p => (
                          <div className="roster-row" key={p.id}>
                            <span className="nm"><span className="num-badge">#{p.number}</span> {p.name}</span>
                            <b className="p">₹{(p.soldPrice || 0).toLocaleString()}</b>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="team-actions">
                    {isAuctioneer ? (
                      <button className="ghost-btn" onClick={() => onAdjustBudget(t)}>
                        <Wallet size={14} /> Budget
                      </button>
                    ) : (
                      <span />
                    )}
                    <button className="primary-btn" onClick={() => toggleRoster(t.id)}>
                      {rosterOpen ? 'Hide roster' : 'Roster'} <ArrowRight size={14} />
                    </button>
                  </div>

                  {isAuctioneer && (
                    <div className="team-actions">
                      <button className="ghost-btn" onClick={() => onOwnerLogin(t)}>
                        <KeyRound size={14} /> Assign owner
                      </button>
                      <button className="danger-btn" style={{ borderRadius: 10 }} onClick={() => onDeleteTeam(t.name)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
