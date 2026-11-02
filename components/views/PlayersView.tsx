'use client'

import { useMemo } from 'react'
import { Plus, FileText, Gavel, Search, Swords, Trash2, Zap, RotateCcw, Shield } from 'lucide-react'
import type { Player } from '@/lib/server/db'

const STATUS_BY_FILTER: Record<string, Player['status'] | undefined> = {
  UPCOMING: 'Upcoming',
  SOLD: 'Sold',
  UNSOLD: 'Unsold'
}

export function PlayersView({
  players,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  isAuctioneer,
  maxSquadSize,
  defaultPurse,
  onAddPlayer,
  onBulkImport,
  onDeletePlayer,
  onReopenPlayer,
  onNominate,
  onDirectSell,
  onOpenAuction
}: {
  players: Player[]
  search: string
  setSearch: (s: string) => void
  roleFilter: string
  setRoleFilter: (r: string) => void
  isAuctioneer: boolean
  maxSquadSize: number
  defaultPurse: number
  onAddPlayer: () => void
  onBulkImport: () => void
  onDeletePlayer: (id: number) => void
  onReopenPlayer: (id: number) => void
  onNominate: (id: number) => void
  onDirectSell: (player?: Player) => void
  onOpenAuction: () => void
}) {
  const count = (status: Player['status']) => players.filter(p => p.status === status).length
  const filters = [
    { id: 'ALL', label: 'All', count: players.length },
    { id: 'UPCOMING', label: 'Available', count: count('Upcoming') },
    { id: 'SOLD', label: 'Sold', count: count('Sold') },
    { id: 'UNSOLD', label: 'Unsold', count: count('Unsold') }
  ]

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace('#', '').trim()
    const status = STATUS_BY_FILTER[roleFilter]
    return players.filter(p => {
      if (status && p.status !== status) return false
      return !q || p.name.toLowerCase().includes(q) || String(p.number || '').includes(q)
    })
  }, [players, search, roleFilter])

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Player pool <span className="pill" style={{ verticalAlign: 'middle' }}>{players.length} in pool</span></h2>
        </div>
        {isAuctioneer && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ghost-btn btn-sm" onClick={onBulkImport}><FileText size={14} /> Add from Text</button>
            <button className="primary-btn btn-sm" onClick={onAddPlayer}><Plus size={14} /> Add Player</button>
          </div>
        )}
      </div>

      <div className="search-box">
        <Search size={17} />
        <input
          type="search"
          placeholder="Search player name or #number"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-row">
        {filters.map(f => (
          <button
            key={f.id}
            className={roleFilter === f.id ? 'filter-active' : ''}
            onClick={() => setRoleFilter(f.id)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="rule-banner">
        <div className="l">
          <span className="ico"><Gavel size={18} /></span>
          <div>
            <small>Auction draft rule</small>
            <b>Base Price ₹500 · {maxSquadSize} Players Squad</b>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <small>Purse cap</small>
          <b className="big">₹{defaultPurse >= 1000 ? `${defaultPurse / 1000}K` : defaultPurse}</b>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <Swords size={38} />
          <h3>No players registered</h3>
          <p>Players can be added at any time, even during the live auction.</p>
          {isAuctioneer && (
            <button className="primary-btn" onClick={onAddPlayer}><Plus size={16} /> Add Player</button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p style={{ margin: '0 auto' }}>No players match these filters.</p></div>
      ) : (
        <div className="players-grid">
          {filtered.map(p => (
            <article className="player-card" key={p.id}>
              <div className="player-card-top">
                <span className="avatar sm">
                  {p.initials}
                  <span className="tag">#{p.number}</span>
                </span>
                <div className="info">
                  <h3>{p.name}</h3>
                  <div className="sub">Player #{p.number}</div>
                </div>
                <span className={p.status === 'Sold' ? 'pill dark' : p.status === 'Unsold' ? 'pill red' : 'pill'}>
                  {p.status === 'Upcoming' ? 'In pool' : p.status}
                </span>
              </div>

              <div className="player-card-bottom">
                {p.status === 'Sold' ? (
                  <>
                    <div>
                      <small>Acquired by</small>
                      <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> {p.soldTo}</b>
                    </div>
                    <div>
                      <small style={{ textAlign: 'right' }}>Sold price</small>
                      <div className="amt">₹{(p.soldPrice || 0).toLocaleString()}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <small>Draft status</small>
                      <b>{p.status === 'Unsold' ? 'Unsold' : 'Upcoming'}</b>
                    </div>
                    <div>
                      <small style={{ textAlign: 'right' }}>Reserve base</small>
                      <div className="amt">₹{(p.base || 500).toLocaleString()}</div>
                    </div>
                  </>
                )}
              </div>

              {isAuctioneer && (
                <div className="acts">
                  <button className="mini-btn fill" onClick={() => onNominate(p.id)}>
                    <Gavel size={12} /> {p.status === 'Upcoming' ? 'Nominate' : 'Re-auction'}
                  </button>
                  <button className="mini-btn" onClick={() => onDirectSell(p)}>
                    <Zap size={12} /> {p.status === 'Sold' ? 'Reassign' : 'Sell'}
                  </button>
                  {p.status !== 'Upcoming' && (
                    <button className="mini-btn" onClick={() => onReopenPlayer(p.id)} title="Return to the available pool">
                      <RotateCcw size={12} /> Reopen
                    </button>
                  )}
                  <button
                    className="mini-btn warn"
                    style={{ flex: '0 0 36px' }}
                    onClick={() => onDeletePlayer(p.id)}
                    aria-label={`Remove ${p.name}`}
                    title="Remove player"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <button className="fab" onClick={onOpenAuction}>
        <Gavel size={16} /> Live Desk <span className="dot" />
      </button>
    </div>
  )
}
