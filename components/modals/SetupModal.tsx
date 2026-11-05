'use client'

import React, { useState } from 'react'
import { Settings2, KeyRound, Check, X } from 'lucide-react'

export function SetupModal({
  leagueName,
  season,
  defaultPurse,
  maxSquadSize,
  leagueMatches,
  knockout,
  onClose,
  onSave,
  onChangePin
}: {
  leagueName: string
  season: string
  defaultPurse: number
  maxSquadSize: number
  leagueMatches: number | null
  knockout: 'semis' | 'final'
  onClose: () => void
  onSave: (settings: {
    name: string
    season: string
    defaultPurse: number
    maxSquadSize: number
    leagueMatches?: number
    knockout: 'semis' | 'final'
  }) => void
  onChangePin: (currentPin: string, newPin: string) => Promise<string | null>
}) {
  const [name, setName] = useState(leagueName)
  const [sea, setSea] = useState(season)
  const [purse, setPurse] = useState(defaultPurse)
  const [squad, setSquad] = useState(maxSquadSize)
  const [games, setGames] = useState(leagueMatches ? String(leagueMatches) : '')
  const [format, setFormat] = useState(knockout)

  // PIN Changer State
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [pinOk, setPinOk] = useState(false)

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: name.trim() || 'The Rivalry League',
      season: sea.trim() || '01',
      defaultPurse: purse || 20000,
      maxSquadSize: squad || 11,
      leagueMatches: Number(games) || undefined,
      knockout: format
    })
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinMsg('')
    setPinOk(false)
    if (newPin !== confirmPin) {
      setPinMsg('The two new passwords do not match')
      return
    }
    const failure = await onChangePin(currentPin, newPin)
    if (failure) {
      setPinMsg(failure)
      return
    }
    setPinOk(true)
    setPinMsg('Password updated. Use the new one next time you sign in.')
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '520px' }}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={20} style={{ color: 'var(--gold)' }} />
            <div>
              <span className="section-kicker">MASTER CONFIGURATION</span>
              <h2 style={{ fontSize: '24px', margin: 0 }}>League <em>Settings.</em></h2>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSaveSettings} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="field-row" style={{ marginTop: 0 }}>
            <label>
              LEAGUE NAME
              <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>
              SEASON #
              <input value={sea} onChange={e => setSea(e.target.value)} required />
            </label>
          </div>

          <div className="field-row" style={{ marginTop: 0 }}>
            <label>
              DEFAULT PURSE / TEAM (₹)
              <input
                type="number"
                value={purse}
                onChange={e => setPurse(Number(e.target.value) || 20000)}
                required
              />
            </label>
            <label>
              TARGET SQUAD SIZE / TEAM
              <select value={squad} onChange={e => setSquad(Number(e.target.value))}>
                {[3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => (
                  <option key={n} value={n}>{n} Players / Team</option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-row" style={{ marginTop: 0 }}>
            <label>
              LEAGUE MATCHES
              <input
                type="number"
                min={1}
                max={200}
                value={games}
                onChange={e => setGames(e.target.value)}
                placeholder="e.g. 6"
              />
            </label>
            <label>
              KNOCKOUT FORMAT
              <select value={format} onChange={e => setFormat(e.target.value === 'final' ? 'final' : 'semis')}>
                <option value="semis">Top 4 → semi-finals → final</option>
                <option value="final">Top 2 → final</option>
              </select>
            </label>
          </div>
          <small style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '-6px' }}>
            {format === 'semis'
              ? 'After the last league match: 1st v 4th and 2nd v 3rd, winners play the final.'
              : 'After the last league match: 1st v 2nd in the final.'}
          </small>

          <button type="submit" className="primary-btn" style={{ marginTop: '4px' }}>
            <Check size={16} /> Save League Settings
          </button>
        </form>

        {/* Change superadmin password */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
          <span className="section-kicker" style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={12} /> CHANGE SUPERADMIN PASSWORD
          </span>
          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <label style={{ margin: 0 }}>
              CURRENT PASSWORD
              <input
                type="password"
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <div className="field-row" style={{ marginTop: 0 }}>
              <label style={{ margin: 0 }}>
                NEW PASSWORD (6+)
                <input
                  type="password"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label style={{ margin: 0 }}>
                REPEAT NEW
                <input
                  type="password"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            <button type="submit" className="ghost-btn">Update Password</button>
          </form>
          {pinMsg && (
            <small style={{ display: 'block', marginTop: '6px', color: pinOk ? 'var(--green)' : 'var(--red)', fontSize: '12px', fontWeight: 600 }}>
              {pinMsg}
            </small>
          )}
        </div>
      </div>
    </div>
  )
}

