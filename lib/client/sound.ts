// Auction and match sounds, synthesised with the Web Audio API so there are no files to load

const MUTED_KEY = 'trl_muted'

type Tone = {
  type: OscillatorType
  from: number
  to?: number
  volume: number
  length: number
  delay?: number
}

class SoundManager {
  private ctx: AudioContext | null = null
  private muted = false

  /** Browsers keep audio silent until the first tap, so call this from one. */
  unlock() {
    this.context()
  }

  loadMuted(): boolean {
    try {
      this.muted = localStorage.getItem(MUTED_KEY) === '1'
    } catch {
      /* storage unavailable */
    }
    return this.muted
  }

  setMuted(muted: boolean) {
    this.muted = muted
    try {
      localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }

  private context(): AudioContext | null {
    if (typeof window === 'undefined' || !window.AudioContext) return null
    this.ctx ??= new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private play(tones: Tone[]) {
    if (this.muted) return
    const ctx = this.context()
    if (!ctx) return

    for (const { type, from, to, volume, length, delay = 0 } of tones) {
      const start = ctx.currentTime + delay
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(from, start)
      if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length)
      gain.gain.setValueAtTime(volume, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + length)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + length + 0.02)
    }
  }

  /** Superadmin pressed spin. */
  playTick() {
    this.play([{ type: 'square', from: 600, to: 200, volume: 0.18, length: 0.04 }])
  }

  /** The wheel's clicks, slowing down as it stops. */
  playWheel(startsInMs: number, durationMs: number) {
    const clicks = 26
    this.play(
      Array.from({ length: clicks }, (_, i) => ({
        type: 'square' as const,
        from: 520,
        to: 240,
        volume: 0.08,
        length: 0.03,
        delay: (startsInMs + durationMs * (1 - (1 - i / clicks) ** 2.4)) / 1000
      }))
    )
  }

  /** A player comes on the block. */
  playHammer() {
    this.play([{ type: 'triangle', from: 140, to: 35, volume: 0.7, length: 0.22 }])
  }

  /** A new top bid. */
  playBid() {
    this.play([
      { type: 'sine', from: 660, volume: 0.2, length: 0.09 },
      { type: 'sine', from: 880, volume: 0.2, length: 0.12, delay: 0.07 }
    ])
  }

  /** A player is sold. */
  playSold() {
    this.play([
      { type: 'triangle', from: 140, to: 35, volume: 0.6, length: 0.22 },
      ...[440, 554.37, 659.25, 880].map((from, i) => ({
        type: 'sine' as const,
        from,
        volume: 0.2,
        length: 0.35,
        delay: 0.14 + i * 0.06
      }))
    ])
  }

  /** A player goes unsold. */
  playUnsold() {
    this.play([{ type: 'sine', from: 330, to: 165, volume: 0.25, length: 0.4 }])
  }

  /** The coin in the air. */
  playCoinFlip() {
    this.play(
      [0, 1, 2, 3].map(i => ({
        type: 'sine' as const,
        from: 800 + i * 160,
        volume: 0.25,
        length: 0.07,
        delay: i * 0.08
      }))
    )
  }

  /** A team wins a match. */
  playVictory() {
    this.play(
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].map((from, i) => ({
        type: 'triangle' as const,
        from,
        volume: 0.22,
        length: i === 5 ? 0.6 : 0.2,
        delay: i * 0.13
      }))
    )
  }
}

export const sounds = new SoundManager()
