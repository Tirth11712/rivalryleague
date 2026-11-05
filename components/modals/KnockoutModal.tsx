'use client'

import React, { useState } from 'react'
import { Trophy, X } from 'lucide-react'
import type { Pairing } from '@/lib/shared/playoffs'

/** Confirms the semi-finals or the final, pre-filled from the points table. */
export function KnockoutModal({
  round,
  pairings,
  onClose,
  onCreate
}: {
  round: 'semis' | 'final'
  pairings: Pairing[]
  onClose: () => void
  onCreate: (data: { round: 'semis' | 'final'; pairings: Pairing[]; date: string; venue: string }) => Promise<unknown> | void
}) {
  const [picks, setPicks] = useState(pairings)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [venue, setVenue] = useState('Premier Grounds')
  const [saving, setSaving] = useState(false)

  const qualified = pairings.flatMap(p => [p.teamA, p.teamB])
  const chosen = picks.flatMap(p => [p.teamA, p.teamB])
  const valid = new Set(chosen).size === chosen.length

  const set = (i: number, side: 'teamA' | 'teamB', name: string) =>
    setPicks(prev => prev.map((p, k) => (k === i ? { ...p, [side]: name } : p)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await onCreate({ round, pairings: picks, date, venue })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '480px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN · KNOCKOUTS</span>
            <h2>{round === 'semis' ? <>Create <em>semi-finals.</em></> : <>Create the <em>final.</em></>}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={submit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <small style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            {round === 'semis'
              ? 'Filled in from the points table: 1st v 4th and 2nd v 3rd. Check it, then add the date and venue.'
              : 'Filled in from the results so far. Check it, then add the date and venue.'}
          </small>

          {picks.map((p, i) => (
            <div key={p.stage}>
              <span className="section-kicker"><Trophy size={11} /> {p.stage.toUpperCase()}</span>
              <div className="field-row" style={{ marginTop: 6 }}>
                {(['teamA', 'teamB'] as const).map(side => (
                  <label key={side}>
                    {side === 'teamA' ? 'TEAM 1' : 'TEAM 2'}
                    <select value={p[side]} onChange={e => set(i, side, e.target.value)}>
                      {qualified.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!valid && <small style={{ color: 'var(--red)', fontSize: 12 }}>Each team can play only once.</small>}

          <label>
            DATE
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </label>
          <label>
            VENUE
            <input value={venue} onChange={e => setVenue(e.target.value)} />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={!valid || saving}>
              <Trophy size={16} /> {saving ? 'Creating…' : round === 'semis' ? 'Create Semi-finals' : 'Create Final'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
