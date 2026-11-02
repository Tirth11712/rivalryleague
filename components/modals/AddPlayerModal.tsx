'use client'

import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function AddPlayerModal({
  onClose,
  onAdd,
  nextNumber
}: {
  onClose: () => void
  onAdd: (player: { name: string; base: number }) => void
  nextNumber: number
}) {
  const [name, setName] = useState('')
  const [base, setBase] = useState(500)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      base: base || 500
    })
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '440px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN · PLAYER #{nextNumber}</span>
            <h2>Register <em>Player #{nextNumber}.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label>
            PLAYER FULL NAME (WILL BE ASSIGNED NUMBER #{nextNumber})
            <input
              placeholder="e.g. Rohit Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label>
            BASE PRICE (₹)
            <input
              type="number"
              value={base}
              onChange={e => setBase(Number(e.target.value) || 500)}
              min="100"
              step="50"
              required
            />
            <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
              Standard league base price is ₹500 per player.
            </small>
          </label>

          <div className="modal-actions" style={{ marginTop: '10px' }}>
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn"><Plus size={16} /> Add to Pool (₹{base})</button>
          </div>
        </form>
      </div>
    </div>
  )
}

