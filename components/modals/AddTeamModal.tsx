'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ColorWheel } from '@/components/common/ColorWheel'

export function AddTeamModal({
  defaultPurse,
  onClose,
  onAdd
}: {
  defaultPurse: number
  onClose: () => void
  onAdd: (team: { name: string; owner: string; color: string; purse: number }) => void
}) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [color, setColor] = useState('#22d3ee')
  const [purse, setPurse] = useState<number>(defaultPurse)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), owner: owner.trim() || 'Owner', color, purse })
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '480px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN</span>
            <h2>Add <em>Franchise.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            FRANCHISE NAME
            <input
              placeholder="e.g. Royal Challengers"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </label>
          <div className="field-row" style={{ marginTop: 0 }}>
            <label>
              CAPTAIN / OWNER
              <input
                placeholder="e.g. Virat"
                value={owner}
                onChange={e => setOwner(e.target.value)}
              />
            </label>
            <label>
              INITIAL PURSE BUDGET (₹)
              <input
                type="number"
                value={purse}
                onChange={e => setPurse(Number(e.target.value) || defaultPurse)}
                required
              />
            </label>
          </div>
          <div>
            <span className="section-kicker" style={{ display: 'block', marginBottom: 8 }}>FRANCHISE COLOUR</span>
            <ColorWheel value={color} onChange={setColor} />
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn"><Plus size={16} /> Register Franchise</button>
          </div>
        </form>
      </div>
    </div>
  )
}
