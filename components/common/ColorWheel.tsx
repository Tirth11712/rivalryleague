'use client'

import React, { useRef, useState } from 'react'

type Hsv = { h: number; s: number; v: number } // h 0-360, s and v 0-1

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

function hexToHsv(hex: string): Hsv | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}

/** RGB colour wheel: drag on the wheel for hue and strength, the slider for brightness, or type a hex code. */
export function ColorWheel({ value, onChange, size = 180 }: { value: string; onChange: (hex: string) => void; size?: number }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) || { h: 190, s: 0.85, v: 0.93 })
  const [hexText, setHexText] = useState(value)
  const wheel = useRef<HTMLDivElement>(null)

  const update = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexText(hex)
    onChange(hex)
  }

  const pick = (e: React.PointerEvent) => {
    const box = wheel.current?.getBoundingClientRect()
    if (!box) return
    const dx = e.clientX - (box.left + box.width / 2)
    const dy = e.clientY - (box.top + box.height / 2)
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360 // 0° at the top, clockwise, like the gradient
    const s = Math.min(1, Math.hypot(dx, dy) / (box.width / 2))
    update({ ...hsv, h, s })
  }

  // Marker position for the current hue and strength
  const r = (hsv.s * size) / 2
  const rad = (hsv.h * Math.PI) / 180
  const mx = size / 2 + r * Math.sin(rad)
  const my = size / 2 - r * Math.cos(rad)
  const current = hsvToHex(hsv)

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div
        ref={wheel}
        role="slider"
        aria-label="Colour wheel"
        aria-valuetext={current}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e) }}
        onPointerMove={e => { if (e.buttons) pick(e) }}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          cursor: 'crosshair',
          touchAction: 'none',
          flexShrink: 0,
          background:
            'radial-gradient(closest-side, #fff, rgba(255,255,255,0)), conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          boxShadow: '0 0 0 1px var(--line)'
        }}
      >
        {/* Darkens the whole wheel as brightness goes down */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#000', opacity: 1 - hsv.v, pointerEvents: 'none' }} />
        <span
          style={{
            position: 'absolute',
            left: mx - 9,
            top: my - 9,
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '3px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,.45), 0 1px 4px rgba(0,0,0,.4)',
            background: current,
            pointerEvents: 'none'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 120px', minWidth: 120 }}>
        <div style={{ height: 42, borderRadius: 10, background: current, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
        <label style={{ margin: 0 }}>
          BRIGHTNESS
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={e => update({ ...hsv, v: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: current }}
          />
        </label>
        <label style={{ margin: 0 }}>
          HEX
          <input
            value={hexText}
            maxLength={7}
            onChange={e => {
              setHexText(e.target.value)
              const parsed = hexToHsv(e.target.value)
              if (parsed) {
                setHsv(parsed)
                onChange(hsvToHex(parsed))
              }
            }}
            style={{ fontFamily: 'monospace' }}
          />
        </label>
      </div>
    </div>
  )
}
