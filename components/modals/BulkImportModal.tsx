'use client'

import React, { useMemo, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { parsePlayerList, withoutDuplicates, type ParsedPlayer } from '@/lib/shared/parsePlayerList'

const PREVIEW_ROWS = 6

export function BulkImportModal({
  onClose,
  onImport,
  nextNumber,
  existingNames
}: {
  onClose: () => void
  onImport: (players: ParsedPlayer[]) => void
  nextNumber: number
  existingNames: string[]
}) {
  const [text, setText] = useState('')
  const { fresh, skipped } = useMemo(
    () => withoutDuplicates(parsePlayerList(text), existingNames),
    [text, existingNames]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (fresh.length > 0) onImport(fresh)
  }

  return (
    <div className="modal-backdrop">
      <div className="setup-modal" style={{ maxWidth: '520px' }}>
        <div className="modal-head">
          <div>
            <span className="section-kicker">SUPERADMIN · STARTING AT #{nextNumber}</span>
            <h2>Add players <em>from text.</em></h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label>
            PASTE YOUR PLAYER LIST
            <textarea
              className="bulk-text"
              placeholder={'1. Rohit Sharma\n2. Jasprit Bumrah\nVirat Kohli, 700\nHardik Pandya'}
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
              required
            />
          </label>
          <p className="bulk-hint">
            One player per line, or names separated by commas. List numbers and bullets are removed.
            The base price is ₹500 unless a line ends with one, like <b>Virat Kohli, 700</b>.
          </p>

          {text.trim() && (
            <div className="bulk-preview">
              <b>
                {fresh.length} player{fresh.length === 1 ? '' : 's'} to add
                {skipped > 0 && ` · ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped`}
              </b>
              {fresh.slice(0, PREVIEW_ROWS).map((p, i) => (
                <span key={p.name}>
                  #{nextNumber + i} {p.name} · ₹{p.base.toLocaleString()}
                </span>
              ))}
              {fresh.length > PREVIEW_ROWS && <span>and {fresh.length - PREVIEW_ROWS} more</span>}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={fresh.length === 0}>
              <Upload size={16} /> Add {fresh.length || ''} Player{fresh.length === 1 ? '' : 's'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
