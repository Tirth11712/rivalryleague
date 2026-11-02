'use client'

import {
  Shield,
  Users,
  User,
  UserCheck,
  Lock,
  Volume2,
  VolumeX,
  Settings2,
  House,
  Gavel,
  Swords,
  CalendarDays,
  Trophy
} from 'lucide-react'

const SEASONS = ['01', '02', '03', '04', '05', '06', '07']
const SQUAD_SIZES = [3, 4, 5, 6, 7, 8, 9, 10, 11]
const SCHEDULE_PAGES = ['schedule', 'results']

const navItems = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'auction', label: 'Auction', icon: Gavel },
  { id: 'teams', label: 'Teams', icon: Shield },
  { id: 'players', label: 'Players', icon: Swords },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'standings', label: 'Table', icon: Trophy }
]

export function Topbar({
  page,
  setPage,
  leagueName,
  season,
  onUpdateSeason,
  maxSquadSize,
  onUpdateSquadLimit,
  isAuctioneer,
  setIsAuctioneer,
  ownerTeamName,
  onOwnerLogout,
  onOpenAuth,
  isMuted,
  onToggleSound,
  onOpenSettings
}: {
  page: string
  setPage: (p: string) => void
  leagueName: string
  season: string
  onUpdateSeason: (season: string) => void
  maxSquadSize: number
  onUpdateSquadLimit: (limit: number) => void
  isAuctioneer: boolean
  setIsAuctioneer: (v: boolean) => void
  ownerTeamName: string | null
  onOwnerLogout: () => void
  onOpenAuth: () => void
  isMuted: boolean
  onToggleSound: () => void
  onOpenSettings: () => void
}) {
  const isActive = (id: string) =>
    id === 'schedule' ? SCHEDULE_PAGES.includes(page) : page === id

  const handleAccount = () => {
    if (isAuctioneer) setIsAuctioneer(false)
    else if (ownerTeamName) onOwnerLogout()
    else onOpenAuth()
  }

  const accountTitle = isAuctioneer
    ? 'Sign out of superadmin'
    : ownerTeamName
    ? `Sign out of ${ownerTeamName}`
    : 'Sign in'

  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => setPage('home')}>
          <img className="brand-mark" src="/icon.svg" alt="" width={36} height={36} />
          <span className="brand-text">
            <span className="brand-title">
              <span className="nm">{(leagueName || 'The Rivalry League').replace(/^the\s+/i, '')}</span>
              {isAuctioneer ? (
                <select
                  className="season-chip"
                  value={season}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onUpdateSeason(e.target.value)}
                  aria-label="Season"
                >
                  {[...new Set([...SEASONS, season])].map(s => <option key={s} value={s}>S{s}</option>)}
                </select>
              ) : (
                <span className="season-chip">S{season}</span>
              )}
            </span>
            {ownerTeamName && <span className="brand-sub">Owner · {ownerTeamName}</span>}
          </span>
        </button>

        <nav className="desktop-nav">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={isActive(item.id) ? 'nav-active' : ''}
                onClick={() => setPage(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="top-actions">
          <div className="top-pill hide-xs" title="Players per franchise">
            <Users size={13} />
            {isAuctioneer ? (
              <select
                value={maxSquadSize}
                onChange={e => onUpdateSquadLimit(Number(e.target.value))}
                aria-label="Squad size"
              >
                {SQUAD_SIZES.map(n => <option key={n} value={n}>{n}/team</option>)}
              </select>
            ) : (
              <span>{maxSquadSize}/team</span>
            )}
          </div>

          <button
            className="icon-btn"
            onClick={onToggleSound}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
            aria-pressed={!isMuted}
            title={isMuted ? 'Turn sound on' : 'Turn sound off'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {isAuctioneer && (
            <button
              className="icon-btn"
              onClick={onOpenSettings}
              aria-label="League settings"
              title="League settings"
            >
              <Settings2 size={15} />
            </button>
          )}

          <button
            className={isAuctioneer ? 'avatar-btn' : ownerTeamName ? 'avatar-btn owner' : 'avatar-btn locked'}
            onClick={handleAccount}
            aria-label={accountTitle}
            title={accountTitle}
          >
            {isAuctioneer ? <User size={16} /> : ownerTeamName ? <UserCheck size={16} /> : <Lock size={15} />}
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Main navigation">
        {navItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.id)
          return (
            <button
              key={item.id}
              className={active ? 'nav-active' : ''}
              onClick={() => setPage(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
