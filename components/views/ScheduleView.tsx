'use client'

import { useMemo } from 'react'
import { CalendarDays, Plus, Coins, Trash2, ClipboardList, Trophy, Dices } from 'lucide-react'
import type { Match, Team } from '@/lib/server/db'
import { isLeagueMatch, playoffPhase, type KnockoutFormat, type KnockoutRound, type Pairing } from '@/lib/shared/playoffs'

export function ScheduleView({
  matches,
  teams,
  filter,
  setFilter,
  isAuctioneer,
  onAddMatch,
  onDeleteMatch,
  onOpenToss,
  onOpenResult,
  onQuickToss,
  leagueMatches,
  knockout,
  onCreateKnockouts,
  onRoundRobin
}: {
  matches: Match[]
  teams: Team[]
  filter: string
  setFilter: (f: string) => void
  isAuctioneer: boolean
  onAddMatch: () => void
  onDeleteMatch: (id: string) => void
  onOpenToss: (m: Match) => void
  onOpenResult: (m: Match) => void
  onQuickToss: () => void
  leagueMatches: number | null
  knockout: KnockoutFormat
  onCreateKnockouts: (round: KnockoutRound, pairings: Pairing[]) => void
  onRoundRobin: () => void
}) {
  const knockoutsStarted = matches.some(m => !isLeagueMatch(m))
  const phase = useMemo(() => playoffPhase(teams, matches, leagueMatches, knockout), [teams, matches, leagueMatches, knockout])
  const leagueCount = matches.filter(isLeagueMatch).length
  const banner = (() => {
    switch (phase.phase) {
      case 'unset': return isAuctioneer ? 'Set the number of league matches (asked when you add a match) so the knockout teams can be decided.' : ''
      case 'league': return `League stage: ${phase.played} of ${phase.total} matches played${phase.scheduled < phase.total ? ` · ${phase.total - phase.scheduled} still to schedule` : ''}.`
      case 'too-few-teams': return `League stage complete. ${knockout === 'semis' ? 'Semi-finals need' : knockout === 'eliminator' ? 'The eliminator format needs' : 'The final needs'} at least ${phase.needed} teams.`
      case 'semis-ready': return 'League stage complete - the top 4 go to the semi-finals.'
      case 'semis': return 'Semi-finals under way. The final can be created once both have a result.'
      case 'eliminator-ready': return `League stage complete - ${phase.pairings[0].teamA} v ${phase.pairings[0].teamB} in the eliminator; the league leader waits in the final.`
      case 'eliminator': return 'Eliminator under way. The final can be created once it has a result.'
      case 'final-ready': return 'Finalists decided.'
      case 'final': return 'The final is scheduled.'
      case 'done': return `🏆 ${phase.champion} are the champions!`
    }
  })()
  const filtered = matches.filter(m => filter === 'ALL' || m.status === filter)
  const count = (status: string) => matches.filter(m => m.status === status).length

  const filters = [
    { id: 'ALL', label: 'All', count: matches.length },
    { id: 'Scheduled', label: 'Upcoming', count: count('Scheduled') },
    { id: 'Toss Done', label: 'Toss done', count: count('Toss Done') },
    { id: 'Completed', label: 'Completed', count: count('Completed') }
  ]

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Match <em>schedule</em></h2>
        </div>
        {isAuctioneer && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ghost-btn btn-sm" onClick={onQuickToss}><Coins size={14} /> Quick Toss</button>
            {!knockoutsStarted && (
              <button className="ghost-btn btn-sm" onClick={onRoundRobin} disabled={teams.length < 2}>
                <Dices size={14} /> Round Robin
              </button>
            )}
            <button className="primary-btn btn-sm" onClick={onAddMatch}>
              <Plus size={14} /> Add Match{leagueMatches ? ` (${Math.min(leagueCount, leagueMatches)}/${leagueMatches})` : ''}
            </button>
          </div>
        )}
      </div>

      {banner && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={16} style={{ color: 'var(--gold)' }} /> {banner}</span>
          {isAuctioneer && phase.phase === 'semis-ready' && (
            <button className="primary-btn btn-sm" onClick={() => onCreateKnockouts('semis', phase.pairings)}>
              <Trophy size={14} /> Create semi-finals
            </button>
          )}
          {isAuctioneer && phase.phase === 'eliminator-ready' && (
            <button className="primary-btn btn-sm" onClick={() => onCreateKnockouts('eliminator', phase.pairings)}>
              <Trophy size={14} /> Create eliminator
            </button>
          )}
          {isAuctioneer && phase.phase === 'final-ready' && (
            <button className="primary-btn btn-sm" onClick={() => onCreateKnockouts('final', phase.pairings)}>
              <Trophy size={14} /> Create final
            </button>
          )}
        </div>
      )}

      {matches.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={38} />
          <h3>No matches scheduled</h3>
          <p>Fixtures appear here once the superadmin creates them.</p>
          {isAuctioneer && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="primary-btn" onClick={onRoundRobin} disabled={teams.length < 2}>
                <Dices size={16} /> Generate Round Robin
              </button>
              <button className="ghost-btn" onClick={onAddMatch}>
                <Plus size={16} /> Add Match
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="filter-row">
            {filters.map(f => (
              <button
                key={f.id}
                className={filter === f.id ? 'filter-active' : ''}
                onClick={() => setFilter(f.id)}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="matches-grid">
            {filtered.map(m => (
              <article className="match-card" key={m.id}>
                <div className="match-head">
                  <span className="kicker">Match {m.matchNumber} · {m.stage}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`status ${m.status.toLowerCase().replace(/\s+/g, '-')}`}>{m.status}</span>
                    {isAuctioneer && (
                      <button
                        className="icon-btn"
                        style={{ width: 34, height: 34 }}
                        onClick={() => onDeleteMatch(m.id)}
                        aria-label={`Delete match ${m.matchNumber}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </span>
                </div>

                <div className="versus">
                  <h4>{m.teamA}</h4>
                  <span className="vs">VS</span>
                  <h4>{m.teamB}</h4>
                </div>

                {m.tossWinner && (
                  <div className="toss-line">
                    <b>{m.tossWinner}</b> won the toss and chose to <b>{m.tossDecision}</b>
                  </div>
                )}

                {m.result && (
                  <div className="result-line">
                    {m.result}
                    {m.scoreA && m.scoreB && (
                      <small>
                        {m.teamA} {m.scoreA.runs}/{m.scoreA.wickets} · {m.teamB} {m.scoreB.runs}/{m.scoreB.wickets}
                      </small>
                    )}
                  </div>
                )}

                <div className="match-foot">
                  <div>
                    <small>{m.date}</small>
                    <small>{m.venue}</small>
                  </div>
                  {isAuctioneer && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {m.status !== 'Completed' && (
                        <button className="ghost-btn btn-sm" onClick={() => onOpenToss(m)}>
                          <Coins size={13} /> {m.tossWinner ? 'Re-flip' : 'Toss'}
                        </button>
                      )}
                      <button className="primary-btn btn-sm" onClick={() => onOpenResult(m)}>
                        <ClipboardList size={13} /> {m.resultType ? 'Edit Result' : 'Enter Result'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
