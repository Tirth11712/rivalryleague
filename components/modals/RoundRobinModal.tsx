'use client'

import React, { useState } from 'react'
import { Dices, X } from 'lucide-react'
import type { Match, Team } from '@/lib/server/db'
import { isLeagueMatch } from '@/lib/shared/playoffs'

/** Adds every league pairing not yet scheduled, once or twice. */
export function RoundRobinModal({
  teams,
  matches,
  leagueMatches,
  oneMeeting,
  onClose,
  onGenerate
}: {
  teams: Team[]
  matches: Match[]
  leagueMatches: number | null
  oneMeeting: boolean
  onClose: () => void
  onGenerate: (data: { double: boolean; startDate: string; venue: string }) => Promise<unknown> | void
}) {
  const [double, setDouble] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [venue, setVenue] = useState('Premier Grounds')
  const [saving, setSaving] = useState(false)

  // Matches the server will add: each pair up to once (or twice), minus what is already scheduled
  const n = teams.length
  const target = double ? 2 : 1
  const met = new Map<string, number>()
  for (const m of matches.filter(isLeagueMatch)) {
    const k = [m.teamA, m.teamB].sort().join('|')
    met.set(k, (met.get(k) || 0) + 1)
  }
  let toAdd = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      toAdd += Math.max(0, target - (met.get([teams[i].name, teams[j].name].sort().join('|')) || 0))
    }
  }
  const leagueAfter = matches.filter(isLeagueMatch).length + toAdd

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || toAdd === 0) return
    setSaving(true)
    try {
      await onGenerate({ double, startDate, venue })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '480px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN · FIXTURES</span>
            <h2>Round <em>robin.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            FORMAT
            <select value={double ? 'double' : 'single'} onChange={e => setDouble(e.target.value === 'double')}>
              <option value="single">Single - every team plays every other team once</option>
              {!oneMeeting && <option value="double">Double - twice, home and away</option>}
            </select>
          </label>
          <div className="field-row" style={{ marginTop: 0 }}>
            <label>
              FIRST MATCH DAY
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </label>
            <label>
              VENUE
              <input value={venue} onChange={e => setVenue(e.target.value)} />
            </label>
          </div>

          <small style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            {n < 2
              ? 'Add at least two teams first.'
              : toAdd === 0
              ? `Every pair already plays ${double ? 'twice' : 'once'} - nothing to add.`
              : `${n} teams → ${toAdd} new league match${toAdd === 1 ? '' : 'es'}, one round per day from the first match day. Pairings already scheduled are skipped.` +
                (leagueMatches && leagueAfter > leagueMatches ? ` League matches will be raised from ${leagueMatches} to ${leagueAfter}.` : '') +
                (!leagueMatches ? ` League matches will be set to ${leagueAfter}.` : '')}
          </small>

          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={saving || toAdd === 0}>
              <Dices size={16} /> {saving ? 'Adding…' : `Add ${toAdd} Match${toAdd === 1 ? '' : 'es'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
