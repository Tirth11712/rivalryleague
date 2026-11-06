'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Match, Team } from '@/lib/server/db'
import { isLeagueMatch } from '@/lib/shared/playoffs'

/** Schedules a league match. Semi-finals and the final are created from the Schedule page instead. */
export function AddMatchModal({
  teams,
  matches,
  leagueMatches,
  oneMeeting,
  onClose,
  onAdd
}: {
  teams: Team[]
  matches: Match[]
  leagueMatches: number | null
  oneMeeting: boolean
  onClose: () => void
  onAdd: (match: { teamA: string; teamB: string; date: string; venue?: string; leagueMatches?: number }) => Promise<unknown> | void
}) {
  const [teamA, setTeamA] = useState(teams[0]?.name || '')
  const [teamB, setTeamB] = useState(teams[1]?.name || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [venue, setVenue] = useState('Premier Grounds')
  const [total, setTotal] = useState('')
  const [saving, setSaving] = useState(false)

  const scheduled = matches.filter(isLeagueMatch).length
  const knockoutsStarted = matches.some(m => !isLeagueMatch(m))
  const full = !!leagueMatches && scheduled >= leagueMatches
  const askTotal = !leagueMatches
  const totalNum = Math.floor(Number(total))
  // In the eliminator format each pair meets once in the league
  const alreadyMet = oneMeeting && !!teamA && !!teamB && matches.some(
    m => isLeagueMatch(m) && ((m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA))
  )
  const totalOk = !askTotal || (totalNum >= Math.max(1, scheduled + 1) && totalNum <= 200)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !teamA || !teamB || teamA === teamB || !totalOk || alreadyMet) return
    setSaving(true)
    try {
      await onAdd({ teamA, teamB, date, venue, ...(askTotal ? { leagueMatches: totalNum } : {}) })
    } finally {
      setSaving(false)
    }
  }

  const blocked = knockoutsStarted
    ? 'The knockouts have started, so no more league matches can be added.'
    : full
    ? `All ${leagueMatches} league matches are scheduled. The knockout button appears on the Schedule page once every league match has a result. To add more, raise “League matches” in League Settings.`
    : ''

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '480px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">
              SUPERADMIN · {leagueMatches ? `LEAGUE MATCH ${Math.min(scheduled + 1, leagueMatches)} OF ${leagueMatches}` : 'FIXTURES'}
            </span>
            <h2>Schedule <em>Match.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {blocked ? (
          <>
            <p style={{ marginTop: 18, color: 'var(--muted)', lineHeight: 1.5 }}>{blocked}</p>
            <div className="modal-actions">
              <button type="button" className="primary-btn" onClick={onClose}>OK</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {askTotal && (
              <label>
                HOW MANY LEAGUE MATCHES THIS SEASON?
                <input
                  type="number"
                  min={Math.max(1, scheduled + 1)}
                  max={200}
                  value={total}
                  onChange={e => setTotal(e.target.value)}
                  placeholder={scheduled ? `at least ${scheduled + 1}` : 'e.g. 6'}
                  required
                  autoFocus
                />
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Asked once - after the last one, the points table decides who plays the knockouts. You can change it in League Settings.
                </small>
              </label>
            )}

            <div className="field-row" style={{ marginTop: 0 }}>
              <label>
                TEAM 1 (HOME)
                <select value={teamA} onChange={e => setTeamA(e.target.value)} required>
                  <option value="">-- Choose Team 1 --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                TEAM 2 (AWAY)
                <select value={teamB} onChange={e => setTeamB(e.target.value)} required>
                  <option value="">-- Choose Team 2 --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.name} disabled={t.name === teamA}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>

            {alreadyMet && (
              <small style={{ color: 'var(--red)', fontSize: 12, marginTop: -6 }}>
                {teamA} and {teamB} already meet in the league - each pair plays once in this format.
              </small>
            )}

            <label>
              DATE
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </label>

            <label>
              VENUE
              <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Wankhede Stadium" />
            </label>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving || !teamA || !teamB || teamA === teamB || !totalOk || alreadyMet}>
                <Plus size={16} /> {saving ? 'Adding…' : 'Add League Match'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
