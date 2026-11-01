'use client'

import {
  Shield,
  Users,
  Swords,
  CalendarDays,
  ClipboardList,
  Wallet,
  ChevronRight,
  Play,
  Coins,
  CircleDollarSign,
  Gavel,
  RefreshCw
} from 'lucide-react'

export function HomeView({
  season,
  teamsCount,
  playersCount,
  matchesCount,
  maxSquadSize,
  defaultPurse,
  onStart,
  onManageTeams,
  onManageSchedule,
  onQuickToss
}: {
  season: string
  teamsCount: number
  playersCount: number
  matchesCount: number
  maxSquadSize: number
  defaultPurse: number
  onStart: () => void
  onManageTeams: () => void
  onManageSchedule: () => void
  onQuickToss: () => void
}) {
  const pad = (n: number) => String(n).padStart(2, '0')

  const rules = [
    { icon: CircleDollarSign, title: '₹500 Base Price', text: 'Every player starts at ₹500 base price with custom incremental bids.' },
    { icon: Users, title: 'Select Squad Size', text: `The superadmin sets the exact player count per franchise (${maxSquadSize} players).` },
    { icon: Gavel, title: 'Hammer Down', text: 'The superadmin chooses which player goes to which team and sets the price.' },
    { icon: Coins, title: 'Match Toss Flip', text: 'Interactive 3D coin toss with official Bat or Bowl calls.' }
  ]

  return (
    <div>
      <section className="hero-card">
        <img className="hero-mark" src="/icon.svg" alt="The Rivalry League crest" width={112} height={112} />
        <div className="eyebrow">
          <span className="live-dot" /> The Rivalry League · Season {season}
        </div>
        <h1>
          The Rivalry League<br />
          <em>Dream XI Draft.</em>
        </h1>
        <p className="hero-copy">
          Official tournament cricket auction. Base price ₹500 per player, dynamic squad limits
          and real-time franchise budgets.
        </p>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onStart}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Play size={15} fill="currentColor" /> Enter Auction Room
            </span>
            <ChevronRight size={16} />
          </button>
          <button className="ghost-btn" onClick={onManageSchedule}>
            <CalendarDays size={16} /> Tournament Schedule &amp; Toss
          </button>
        </div>
      </section>

      <div className="card-label"><span>Tournament cap &amp; stats</span></div>
      <section className="stat-grid four">
        <div className="stat-tile">
          <div className="top"><Shield size={16} /><span className="pill">Active</span></div>
          <b>{pad(teamsCount)}</b><small>Franchises</small>
        </div>
        <div className="stat-tile">
          <div className="top"><Users size={16} /><span className="pill">Draft</span></div>
          <b>{pad(playersCount)}</b><small>Players in pool</small>
        </div>
        <div className="stat-tile">
          <div className="top"><Swords size={16} /><span className="pill">Fixtures</span></div>
          <b>{pad(matchesCount)}</b><small>Fixtures</small>
        </div>
        <div className="stat-tile">
          <div className="top"><ClipboardList size={16} /><span className="pill">Limit</span></div>
          <b>{maxSquadSize}</b><small>Squad limit</small>
        </div>
        <div className="stat-tile wide">
          <Wallet size={20} style={{ color: 'var(--cognac)' }} />
          <div>
            <b>₹{defaultPurse.toLocaleString()}</b>
            <small>Default purse per squad</small>
          </div>
          <span className="pill sand" style={{ marginLeft: 'auto' }}>Fixed cap</span>
        </div>
      </section>

      <section className="card sim-card">
        <div className="head">
          <h3>Match Day Simulator</h3>
          <span className="pill sand">3D toss</span>
        </div>
        <button className="toss-panel" onClick={onQuickToss}>
          <span>
            <h4>Heads or Tails</h4>
            <p>Official Bat or Bowl call, ready for the skippers</p>
          </span>
          <span className="spin-ring"><RefreshCw size={20} /></span>
        </button>
      </section>

      <section style={{ marginTop: 28 }}>
        <span className="kicker">Auction protocols</span>
        <h2 className="section-title">Command guidelines</h2>
        <div className="rule-list">
          {rules.map((rule, i) => {
            const Icon = rule.icon
            return (
              <div className="card rule-card" key={rule.title}>
                <span className="ico"><Icon size={18} /></span>
                <div>
                  <h3>{rule.title}</h3>
                  <p>{rule.text}</p>
                </div>
                <span className="num">{pad(i + 1)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card card-pad" style={{ marginTop: 28 }}>
        <span className="kicker">Superadmin desk</span>
        <h2 className="section-title" style={{ marginTop: 6 }}>Your room.<br />Your tournament.</h2>
        <div className="quick-grid">
          <button className="quick-link" onClick={onManageSchedule}>
            <span className="ico"><CalendarDays size={18} /></span>
            <span>
              <b>Match Schedules &amp; Toss</b>
              <small>{matchesCount} matches scheduled</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
          <button className="quick-link" onClick={onManageTeams}>
            <span className="ico"><Wallet size={18} /></span>
            <span>
              <b>Franchise Roster &amp; Budgets</b>
              <small>{teamsCount} teams · {maxSquadSize} players each</small>
            </span>
            <ChevronRight size={16} className="chev" />
          </button>
        </div>
      </section>
    </div>
  )
}
