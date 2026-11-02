'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Team } from '@/lib/server/db'

export function AddMatchModal({
  teams,
  onClose,
  onAdd
}: {
  teams: Team[]
  onClose: () => void
  onAdd: (match: { teamA: string; teamB: string; date: string; venue?: string; stage?: string }) => void
}) {
  const [teamA, setTeamA] = useState(teams[0]?.name || '')
  const [teamB, setTeamB] = useState(teams[1]?.name || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [venue, setVenue] = useState('Premier Grounds')
  const [stage, setStage] = useState('League Match')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamA || !teamB || teamA === teamB) return
    onAdd({
      teamA,
      teamB,
      date,
      venue,
      stage
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '480px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN · FIXTURES</span>
            <h2>Schedule <em>Match.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

          <label>
            DATE
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </label>

          <label>
            VENUE
            <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Wankhede Stadium" />
          </label>

          <label>
            STAGE / ROUND
            <input value={stage} onChange={e => setStage(e.target.value)} placeholder="e.g. Match 1 / Semi-Final" />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={!teamA || !teamB || teamA === teamB}>
              <Plus size={16} /> Add Match Fixture
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

