'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Player, Team, Match } from '@/lib/server/db'
import type { ClientState } from '@/lib/server/clientState'
import {
  apiAuth,
  apiLeague,
  apiTeams,
  apiPlayers,
  apiAuction,
  apiMatches,
  apiOwner,
  apiState,
  onServerState,
  scheduleSpin,
  type ScheduledSpin,
  type OwnerDetails,
  getAuthToken,
  getOwnerTeamId,
  setAuthToken,
  setOwnerToken
} from '@/lib/client/api'
import type { ParsedPlayer } from '@/lib/shared/parsePlayerList'
import { sounds } from '@/lib/client/sound'
import { useLiveEvents } from '@/lib/client/useLiveEvents'

// Layout & Common Components
import { Topbar } from '@/components/layout/Topbar'
import { Toast } from '@/components/common/Toast'
import { WinBanner } from '@/components/common/WinBanner'

// Views
import { HomeView } from '@/components/views/HomeView'
import { AuctionView, type WheelScope } from '@/components/views/AuctionView'
import { BID_STEPS, minRaiseAfter, WHEEL_REVEAL_PAUSE_MS } from '@/lib/shared/rules'
import { SpectatorView } from '@/components/views/SpectatorView'
import { TeamsView } from '@/components/views/TeamsView'
import { PlayersView } from '@/components/views/PlayersView'
import { ScheduleView } from '@/components/views/ScheduleView'
import { ResultsView } from '@/components/views/ResultsView'
import { StandingsView } from '@/components/views/StandingsView'
import { KNOCKOUT_FORMATS, oneMeetingOnly, type KnockoutFormat, type KnockoutRound, type Pairing } from '@/lib/shared/playoffs'

// Popups load the first time they open
const AuthModal = dynamic(() => import('@/components/modals/AuthModal').then(m => m.AuthModal))
const DirectSellModal = dynamic(() => import('@/components/modals/DirectSellModal').then(m => m.DirectSellModal))
const AddPlayerModal = dynamic(() => import('@/components/modals/AddPlayerModal').then(m => m.AddPlayerModal))
const BulkImportModal = dynamic(() => import('@/components/modals/BulkImportModal').then(m => m.BulkImportModal))
const AddTeamModal = dynamic(() => import('@/components/modals/AddTeamModal').then(m => m.AddTeamModal))
const AdjustBudgetModal = dynamic(() => import('@/components/modals/AdjustBudgetModal').then(m => m.AdjustBudgetModal))
const AddMatchModal = dynamic(() => import('@/components/modals/AddMatchModal').then(m => m.AddMatchModal))
const TossModal = dynamic(() => import('@/components/modals/TossModal').then(m => m.TossModal))
const ResultModal = dynamic(() => import('@/components/modals/ResultModal').then(m => m.ResultModal))
const OwnerLoginModal = dynamic(() => import('@/components/modals/OwnerLoginModal').then(m => m.OwnerLoginModal))
const SetupModal = dynamic(() => import('@/components/modals/SetupModal').then(m => m.SetupModal))
const KnockoutModal = dynamic(() => import('@/components/modals/KnockoutModal').then(m => m.KnockoutModal))
const RoundRobinModal = dynamic(() => import('@/components/modals/RoundRobinModal').then(m => m.RoundRobinModal))

/** A player shown at once while the server saves it; the saved one replaces it. */
function pendingPlayer(name: string, base: number, number: number, i: number): Player {
  const words = name.trim().split(/\s+/)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)).toUpperCase()
  return { id: -(Date.now() + i), number, name: name.trim(), base: base || 500, status: 'Upcoming', initials }
}

export default function Page() {
  // Navigation & Core Entity State
  const [page, setPage] = useState('home')
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [current, setCurrent] = useState<Player | null>(null)
  const [bid, setBid] = useState(0)
  const [minRaise, setMinRaise] = useState<number>(BID_STEPS[0])
  const [leader, setLeader] = useState<Team | null>(null)
  const [spinRequested, setSpinRequested] = useState(false)
  const [liveSpin, setLiveSpin] = useState<ScheduledSpin | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [scheduleFilter, setScheduleFilter] = useState('ALL')

  // League Metadata State
  const [wheelScope, setWheelScope] = useState<WheelScope>('auto')
  const [leagueName, setLeagueName] = useState('The Rivalry League')
  const [season, setSeason] = useState('01')
  const [defaultPurse, setDefaultPurse] = useState(20000)
  const [maxSquadSize, setMaxSquadSize] = useState(11)
  const [leagueMatches, setLeagueMatches] = useState<number | null>(null)
  const [knockout, setKnockout] = useState<KnockoutFormat>('semis')
  const [roundRobinOpen, setRoundRobinOpen] = useState(false)
  const [knockoutRound, setKnockoutRound] = useState<{ round: KnockoutRound; pairings: Pairing[] } | null>(null)

  // Auctioneer Master Auth State
  const [isAuctioneer, setIsAuctioneer] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const [ownerTeamId, setOwnerTeamId] = useState<string | null>(null)

  // Modal Visibility State
  const [setupOpen, setSetupOpen] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [playerModalOpen, setPlayerModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [budgetModalTeam, setBudgetModalTeam] = useState<Team | null>(null)
  const [addMatchModalOpen, setAddMatchModalOpen] = useState(false)
  const [tossModalMatch, setTossModalMatch] = useState<Match | null>(null)
  const [resultModalMatch, setResultModalMatch] = useState<Match | null>(null)
  const [ownerLoginTeam, setOwnerLoginTeam] = useState<Team | null>(null)
  const [directSellPlayer, setDirectSellPlayer] = useState<Player | null>(null)
  const [directSellModalOpen, setDirectSellModalOpen] = useState(false)

  // Live Hammer Desk State
  const [awardTeam, setAwardTeam] = useState<string>('')
  const [awardPrice, setAwardPrice] = useState<number>(500)

  const ownerTeam = teams.find(t => t.id === ownerTeamId) || null

  // Next sequential player number calculation
  const nextPlayerNumber = useMemo(() => {
    return players.reduce((max, p) => Math.max(max, p.number || 0), 0) + 1
  }, [players])

  const toastTimer = useRef<number | undefined>(undefined)
  const lastSync = useRef('')
  const lastAuctionSync = useRef('')
  // Syncs overlap on a slow connection, so a late answer must not undo a newer one
  const syncsStarted = useRef(0)
  const newestSyncApplied = useRef(0)
  const wasSpinning = useRef(false)

  const notify = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3200)
  }

  const stateRev = useRef<number | null>(null)
  const lastStateAt = useRef(-Infinity)

  /** Puts a fresh copy of the league on screen. */
  const applyState = useCallback((state: ClientState, sentAt: number) => {
    const { spin, matches: matchList, league, rev, ...auctionData } = state
    stateRev.current = rev
    lastStateAt.current = performance.now()

    const incoming = spin ? scheduleSpin(spin, sentAt) : null
    setLiveSpin(prev => (prev?.id === incoming?.id ? prev : incoming))

    // Skip re-render (and clobbering of in-progress inputs) when nothing changed
    const signature = JSON.stringify(auctionData)
    if (signature !== lastAuctionSync.current) {
      lastAuctionSync.current = signature
      setPlayers(auctionData.players || [])
      setTeams(auctionData.teams || [])
      setCurrent(auctionData.current || null)
      setBid(auctionData.auctionState?.currentBid || 0)
      setMinRaise(auctionData.auctionState?.minRaise || BID_STEPS[0])
      setLeader(auctionData.leader || null)
      if (auctionData.current) {
        setAwardPrice(auctionData.auctionState?.currentBid || auctionData.current.base || 500)
      }
    }

    const rest = JSON.stringify([matchList, league])
    if (rest !== lastSync.current) {
      lastSync.current = rest
      setMatches(matchList || [])
      if (league) {
        setLeagueName(league.name)
        setSeason(league.season)
        setDefaultPurse(league.defaultPurse || 20000)
        setMaxSquadSize(league.maxSquadSize || 11)
        setLeagueMatches(league.leagueMatches || null)
        setKnockout(KNOCKOUT_FORMATS.includes(league.knockout as KnockoutFormat) ? (league.knockout as KnockoutFormat) : 'semis')
      }
    }
  }, [])

  // Changes shown on screen before the server has answered; refreshes wait until they are saved
  const pendingChanges = useRef(0)

  // Load and synchronize state from backend: one request, and a few bytes when nothing changed
  const loadAuction = useCallback(async () => {
    try {
      const sync = ++syncsStarted.current
      const sentAt = performance.now()
      const data = await apiState.get(stateRev.current)
      // A refresh read before an unsaved change would briefly undo it on screen
      if (!data.success || sync < newestSyncApplied.current || pendingChanges.current > 0) return
      newestSyncApplied.current = sync
      if (data.state) applyState(data.state, sentAt)
    } catch (e) {
      console.error('Failed to sync the league:', e)
    }
  }, [applyState])

  /**
   * Shows a change straight away and saves it in the background. The server's answer carries the
   * saved league, which then replaces the guess, or puts the screen back if the change was refused.
   */
  const instant = async <T,>(show: () => void, save: () => Promise<T>): Promise<T> => {
    pendingChanges.current++
    lastAuctionSync.current = '' // make the server's answer redraw even if it matches the old screen
    lastSync.current = ''
    show()
    try {
      return await save()
    } catch (err) {
      lastStateAt.current = -Infinity // network failure: nothing came back, so fetch the real league
      throw err
    } finally {
      pendingChanges.current--
    }
  }

  // A change's own answer already carried the fresh league; only ask again when it did not
  const loadState = useCallback(async () => {
    if (performance.now() - lastStateAt.current < 1500) return
    await loadAuction()
  }, [loadAuction])

  useEffect(() => {
    onServerState((state, sentAt) => {
      newestSyncApplied.current = ++syncsStarted.current // anything still in flight is older than this
      applyState(state, sentAt)
    })
    return () => onServerState(null)
  }, [applyState])

  useEffect(() => {
    loadAuction()
  }, [loadAuction])

  useEffect(() => {
    if (current) {
      setAwardPrice(bid || current.base || 500)
      if (leader) {
        setAwardTeam(leader.name)
      } else if (teams.length > 0 && !awardTeam) {
        setAwardTeam(teams[0].name)
      }
    } else {
      setAwardPrice(500)
    }
  }, [current, bid, leader, teams, awardTeam])

  const anyModalOpen =
    authModalOpen || setupOpen || teamModalOpen || playerModalOpen || bulkModalOpen ||
    addMatchModalOpen || directSellModalOpen || !!budgetModalTeam || !!tossModalMatch || !!resultModalMatch || !!ownerLoginTeam

  // Live auto-sync so a second screen (projector / spectators) follows the auction
  const watchingAuction = page === 'auction'
  // Fast while a player is up for bids, so every owner sees a rival's bid within a second
  const auctionSyncMs = liveSpin || current ? 700 : watchingAuction ? 1500 : 4000

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden && !anyModalOpen && !spinRequested) loadAuction()
    }, auctionSyncMs)
    return () => window.clearInterval(id)
  }, [loadAuction, anyModalOpen, spinRequested, auctionSyncMs])

  // Ask for the drawn player as soon as the spin is over, so no screen waits for its next sync
  useEffect(() => {
    if (!liveSpin) return
    const revealAt = liveSpin.startsAt + liveSpin.durationMs + WHEEL_REVEAL_PAUSE_MS + 100
    const id = window.setTimeout(loadAuction, Math.max(0, revealAt - performance.now()))
    return () => window.clearTimeout(id)
  }, [liveSpin, loadAuction])

  const celebration = useLiveEvents({ players, matches, current, bid, leader, liveSpin })

  useEffect(() => {
    setIsMuted(sounds.loadMuted())
    const unlock = () => sounds.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // Tell the superadmin who was drawn when the player appears on every screen
  useEffect(() => {
    if (wasSpinning.current && !liveSpin && current && isAuctioneer) {
      if (teams.length > 0) setAwardTeam(teams[0].name)
      notify(
        current.status === 'Unsold'
          ? `[RE-AUCTION ROUND] Unsold Player #${current.number} (${current.name}) drawn on the block!`
          : `Player #${current.number} (${current.name}) drawn on the block!`
      )
    }
    wasSpinning.current = !!liveSpin
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per reveal
  }, [liveSpin, current])

  // Auctioneer Gatekeeper Check
  const guardAuctioneer = <T,>(action: () => T): T | undefined => {
    if (!isAuctioneer) {
      setAuthModalOpen(true)
      notify('Superadmin sign-in required')
      return
    }
    return action()
  }

  // Restore a still-valid session on load; fall back to spectator when it expires
  useEffect(() => {
    if (getAuthToken()) setIsAuctioneer(true)
    setOwnerTeamId(getOwnerTeamId())
    const onExpired = () => {
      setIsAuctioneer(!!getAuthToken())
      setOwnerTeamId(getOwnerTeamId())
      setToast('Session expired - please sign in again')
    }
    window.addEventListener('trl-auth-expired', onExpired)
    return () => window.removeEventListener('trl-auth-expired', onExpired)
  }, [])

  const handleSetAuctioneer = (value: boolean) => {
    if (!value) setAuthToken(null)
    setIsAuctioneer(value)
  }

  const handleVerifyPin = async (pin: string) => {
    setAuthError('')
    try {
      const res = await apiAuth.verifyPin(pin)
      if (res.success && res.token) {
        setAuthToken(res.token)
        setIsAuctioneer(true)
        setAuthModalOpen(false)
        notify(res.defaultPin ? 'Unlocked - change the default password in Settings!' : 'Signed in as superadmin')
      } else {
        setAuthError(res.message || 'Wrong password')
      }
    } catch {
      setAuthError('Could not reach the server')
    }
  }

  const handleOwnerLogin = async (loginId: string, pin: string) => {
    setAuthError('')
    try {
      const res = await apiOwner.login(loginId, pin)
      if (res.success && res.token) {
        setOwnerToken(res.token)
        setOwnerTeamId(res.teamId || null)
        setAuthModalOpen(false)
        setPage('auction')
        notify('Signed in as team owner')
      } else {
        setAuthError(res.message || 'Wrong login ID or password')
      }
    } catch {
      setAuthError('Could not sign in')
    }
  }

  const handleOwnerLogout = () => {
    setOwnerToken(null)
    setOwnerTeamId(null)
    notify('Signed out')
  }

  const ownerBidInFlight = useRef(false)
  const handleOwnerBid = async (increment: number) => {
    if (ownerBidInFlight.current) return // a double tap must not send a second bid
    ownerBidInFlight.current = true
    try {
      const data = await apiOwner.bid(increment)
      notify(data.message)
    } catch {
      notify('Failed to place bid')
    } finally {
      ownerBidInFlight.current = false
      loadState()
    }
  }

  const handleUploadLogo = async (logo: string) => {
    if (!ownerTeamId) return
    try {
      const data = await apiOwner.uploadLogo(ownerTeamId, logo)
      notify(data.message)
    } catch {
      notify('Failed to upload logo')
    } finally {
      loadState()
    }
  }

  const handleRemoveLogo = async () => {
    if (!ownerTeamId) return
    try {
      const data = await apiOwner.removeLogo(ownerTeamId)
      notify(data.message)
    } catch {
      notify('Failed to remove logo')
    } finally {
      loadState()
    }
  }

  const handleSaveOwnerLogin = async (teamId: string, details: OwnerDetails): Promise<string | null> => {
    try {
      const data = await apiOwner.setLogin(teamId, details)
      if (!data.success) return data.message || 'Could not save the owner'
      setAwardTeam('') // the selected team may just have been renamed
      loadState()
      return null
    } catch {
      return 'Could not save the owner'
    }
  }

  const handleChangePin = async (currentPin: string, newPin: string): Promise<string | null> => {
    try {
      const res = await apiAuth.changePin(currentPin, newPin)
      if (!res.success) return res.message || 'Could not change the password'
      notify('Superadmin password changed')
      return null
    } catch {
      return 'Could not reach the server'
    }
  }

  // Sound Control
  const handleToggleSound = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    sounds.setMuted(nextMuted)
    sounds.playTick()
  }

  // League Settings Operations
  const handleUpdateSeason = async (newSeason: string) => {
    guardAuctioneer(async () => {
      setSeason(newSeason)
      try {
        const res = await apiLeague.updateSettings({ season: newSeason })
        notify(res.success ? `Active tournament set to Season ${newSeason}` : res.message || 'Could not update season')
      } catch {
        notify('Failed to update season')
      } finally {
        loadState()
      }
    })
  }

  const handleUpdateSquadLimit = async (newLimit: number) => {
    guardAuctioneer(async () => {
      setMaxSquadSize(newLimit)
      try {
        const res = await apiLeague.updateSettings({ maxSquadSize: newLimit })
        notify(res.success ? `Squad capacity set to ${newLimit} players/team` : res.message || 'Could not update squad limit')
      } catch {
        notify('Failed to update squad limit')
      } finally {
        loadState()
      }
    })
  }

  const handleSaveLeagueSettings = async (settings: {
    name: string
    season: string
    defaultPurse: number
    maxSquadSize: number
    leagueMatches?: number
    knockout?: KnockoutFormat
  }) => {
    guardAuctioneer(async () => {
      try {
        const res = await apiLeague.updateSettings(settings)
        if (res.success) {
          notify('League settings saved')
          setSetupOpen(false)
        } else {
          notify(res.message || 'Could not save settings')
        }
      } catch {
        notify('Failed to save settings')
      } finally {
        loadState()
      }
    })
  }

  const handleReopenAllUnsold = async () => {
    guardAuctioneer(async () => {
      try {
        const data = await apiAuction.reopenAllUnsold()
        notify(data.message)
      } catch {
        notify('Failed to restore unsold players')
      } finally {
        loadState()
      }
    })
  }

  // Auction Room Operations
  const handleSpin = () => {
    guardAuctioneer(async () => {
      if (spinRequested || liveSpin || current) return
      setSpinRequested(true)
      sounds.playTick()

      try {
        // The server picks and schedules the spin; this screen then plays it like every other one
        const sentAt = performance.now()
        const data = await apiAuction.spin(wheelScope)
        if (data.success) {
          newestSyncApplied.current = ++syncsStarted.current // older syncs predate this spin
          setLiveSpin(scheduleSpin(data.spin, sentAt))
        } else {
          notify(data.message)
          loadState()
        }
      } catch {
        notify('Failed to draw from wheel')
        loadState()
      } finally {
        setSpinRequested(false)
      }
    })
  }

  const handleNominate = (playerId: number) => {
    guardAuctioneer(async () => {
      try {
        const data = await apiAuction.nominate(playerId)
        if (data.success) {
          setCurrent(data.player)
          const initialBase = data.player.base || 500
          setBid(initialBase)
          setMinRaise(BID_STEPS[0])
          setAwardPrice(initialBase)
          if (teams.length > 0) setAwardTeam(teams[0].name)
          notify(`Player #${data.player.number} (${data.player.name}) on the block at ₹${initialBase}`)
        } else {
          notify(data.message)
        }
      } catch {
        notify('Failed to nominate player')
      } finally {
        loadState()
      }
    })
  }

  const handleBid = (team: Team, customIncrement?: number) => {
    guardAuctioneer(async () => {
      if (!current) return
      if (team.players >= maxSquadSize) {
        notify(`${team.name} has already reached the maximum squad limit (${maxSquadSize} players)`)
        return
      }

      // Smaller raises close once a bigger one has been used on this player
      const increment = customIncrement || minRaise
      if (increment < minRaise) {
        notify(`Minimum raise is now ₹${minRaise.toLocaleString()}`)
        return
      }

      const nextBid = bid + increment
      if (nextBid > team.purse) {
        notify(`${team.name} has insufficient purse (₹${team.purse.toLocaleString()} left)`)
        return
      }

      try {
        const data = await apiAuction.bid(team.name, nextBid)
        if (data.success) {
          setBid(nextBid)
          setMinRaise(data.auctionState?.minRaise || minRaiseAfter(minRaise, increment))
          setLeader(team)
          setAwardPrice(nextBid)
          setAwardTeam(team.name)
          notify(`₹${nextBid.toLocaleString()} bid for ${team.name}`)
        } else {
          notify(data.message)
        }
      } catch {
        notify('Failed to place bid')
      } finally {
        loadState()
      }
    })
  }

  const handleAwardSell = () => {
    guardAuctioneer(async () => {
      if (!current) {
        notify('No active player in the spotlight')
        return
      }
      if (!awardTeam) {
        notify('Please select which team this player went into')
        return
      }

      const targetTeam = teams.find(t => t.name === awardTeam)
      if (targetTeam && targetTeam.players >= maxSquadSize) {
        notify(`${awardTeam} has already reached max squad size of ${maxSquadSize} players!`)
        return
      }

      try {
        const data = await apiAuction.sell(awardTeam, awardPrice, current.id, bid)
        if (data.success) {
          notify(data.message)
          setCurrent(null)
          setLeader(null)
          setBid(0)
        } else {
          notify(data.message)
        }
      } catch {
        notify('Failed to award player')
      } finally {
        loadState()
      }
    })
  }

  const handleDirectSell = async (playerId: number, teamName: string, price: number) => {
    guardAuctioneer(async () => {
      try {
        const data = await apiAuction.sell(teamName, price, playerId)
        if (data.success) {
          notify(data.message)
          setDirectSellModalOpen(false)
          setDirectSellPlayer(null)
          if (current?.id === playerId) {
            setCurrent(null)
            setBid(0)
            setLeader(null)
          }
        } else {
          notify(data.message)
        }
      } catch {
        notify('Failed to sell player')
      } finally {
        loadState()
      }
    })
  }

  const handleOpenDirectSell = (p?: Player) => {
    guardAuctioneer(() => {
      setDirectSellPlayer(p || null)
      setDirectSellModalOpen(true)
    })
  }

  const handleMarkUnsold = () => {
    guardAuctioneer(async () => {
      if (!current) return
      try {
        const data = await apiAuction.unsold()
        if (data.success) {
          notify(data.message)
          setCurrent(null)
          setLeader(null)
          setBid(0)
        } else {
          notify(data.message || 'Could not mark unsold')
        }
      } catch {
        notify('Failed to mark unsold')
      } finally {
        loadState()
      }
    })
  }

  const handleResetAuction = () => {
    guardAuctioneer(async () => {
      if (!confirm('Are you sure you want to reset the auction? All team budgets and squad allocations will be restored.')) {
        return
      }
      try {
        const data = await apiAuction.reset()
        if (data.success) {
          notify(data.message)
          setCurrent(null)
          setLeader(null)
          setBid(0)
        } else {
          notify(data.message || 'Could not reset the auction')
        }
      } catch {
        notify('Failed to reset auction')
      } finally {
        loadState()
      }
    })
  }

  // Team Operations
  const handleAddTeam = async (t: {
    name: string
    owner: string
    color: string
    purse: number
  }) => {
    guardAuctioneer(async () => {
      try {
        const data = await instant(
          () => {
            const short = t.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
            setTeams(prev => [...prev, { id: `pending_${Date.now()}`, spent: 0, players: 0, short, tagline: '', ...t }])
            setTeamModalOpen(false)
          },
          () => apiTeams.create(t)
        )
        if (data.success) {
          notify(`Franchise "${t.name}" registered with ₹${t.purse.toLocaleString()} purse`)
          if (data.team) setOwnerLoginTeam(data.team) // new teams go straight to owner setup
        } else {
          notify(data.message || 'Error creating team')
        }
      } catch {
        notify('Error creating team')
      } finally {
        loadState()
      }
    })
  }

  const handleDeleteTeam = async (name: string) => {
    guardAuctioneer(async () => {
      if (!confirm(`Delete franchise "${name}"? Any players on this team will be returned to the pool.`)) {
        return
      }
      try {
        const data = await instant(
          () => {
            setTeams(prev => prev.filter(t => t.name !== name))
            setPlayers(prev => prev.map(p => (p.soldTo === name ? { ...p, status: 'Upcoming', soldTo: undefined, soldPrice: undefined } : p)))
          },
          () => apiTeams.delete(name)
        )
        notify(data.success ? `Franchise "${name}" deleted` : data.message || 'Could not delete team')
      } catch {
        notify('Failed to delete team')
      } finally {
        loadState()
      }
    })
  }

  const handleAdjustBudget = async (teamId: string, mode: 'set' | 'add' | 'subtract', amount: number) => {
    guardAuctioneer(async () => {
      try {
        const data = await instant(
          () => {
            setTeams(prev => prev.map(t => {
              if (t.id !== teamId) return t
              const purse = mode === 'set' ? amount : mode === 'add' ? t.purse + amount : t.purse - amount
              return { ...t, purse: Math.max(0, purse) }
            }))
            setBudgetModalTeam(null)
          },
          () => apiTeams.adjustBudget(teamId, mode, amount)
        )
        if (data.success) {
          notify(data.message)
        } else {
          notify(data.message)
        }
      } catch {
        notify('Failed to update team budget')
      } finally {
        loadState()
      }
    })
  }

  // Player Operations (₹500 default base price & sequential numbers)
  const handleAddPlayer = async (p: {
    name: string
    base: number
  }) => {
    return guardAuctioneer(async () => {
      try {
        const data = await instant(
          () => {
            setPlayers(prev => [...prev, pendingPlayer(p.name, p.base, nextPlayerNumber, 0)])
            setPlayerModalOpen(false)
          },
          () => apiPlayers.create(p)
        )
        if (data.success) {
          notify(`Player #${data.player?.number || nextPlayerNumber} "${p.name}" added with base price ₹${p.base || 500}`)
        } else {
          notify(data.message || 'Could not add player')
        }
      } catch {
        notify('Error adding player')
      } finally {
        loadState()
      }
    })
  }

  const handleBulkImport = async (list: ParsedPlayer[]) => {
    return guardAuctioneer(async () => {
      try {
        const data = await instant(
          () => {
            setPlayers(prev => [...prev, ...list.map((p, i) => pendingPlayer(p.name, p.base || 500, nextPlayerNumber + i, i))])
            setBulkModalOpen(false)
          },
          () => apiPlayers.bulkImport(list)
        )
        if (data.success) {
          notify(data.message)
        } else {
          notify((data as { message?: string }).message || 'Could not import players')
        }
      } catch {
        notify('Failed to bulk import')
      } finally {
        loadState()
      }
    })
  }

  const handleDeletePlayer = async (id: number) => {
    guardAuctioneer(async () => {
      const target = players.find(p => p.id === id)
      if (!confirm(`Remove ${target?.name || 'this player'}? A sold player's price goes back to their team.`)) return
      try {
        const data = await instant(() => setPlayers(prev => prev.filter(p => p.id !== id)), () => apiPlayers.delete(id))
        notify(data.success ? 'Player removed' : data.message || 'Could not remove player')
      } catch {
        notify('Failed to delete player')
      } finally {
        loadState()
      }
    })
  }

  const handleDeletePlayers = async (ids: number[], all: boolean) => {
    guardAuctioneer(async () => {
      const gone = new Set(ids)
      const sold = players.filter(p => gone.has(p.id) && p.status === 'Sold').length
      const what = all ? `ALL ${ids.length} players` : `these ${ids.length} players`
      if (!confirm(`Delete ${what}?${sold ? ` ${sold} sold player${sold === 1 ? "'s price goes" : "s' prices go"} back to their teams.` : ''} This cannot be undone.`)) return
      try {
        const data = await instant(
          () => {
            const refunds = new Map<string, { money: number; count: number }>()
            for (const p of players) {
              if (!gone.has(p.id) || p.status !== 'Sold' || !p.soldTo) continue
              const r = refunds.get(p.soldTo) || { money: 0, count: 0 }
              refunds.set(p.soldTo, { money: r.money + (p.soldPrice || 0), count: r.count + 1 })
            }
            setPlayers(prev => prev.filter(p => !gone.has(p.id)))
            setTeams(prev => prev.map(t => {
              const r = refunds.get(t.name)
              return r ? { ...t, purse: t.purse + r.money, spent: Math.max(0, t.spent - r.money), players: Math.max(0, t.players - r.count) } : t
            }))
          },
          () => apiPlayers.deleteMany(ids)
        )
        notify(data.message)
      } catch {
        notify('Failed to delete players')
      } finally {
        loadState()
      }
    })
  }

  const handleReopenPlayer = async (id: number) => {
    guardAuctioneer(async () => {
      try {
        const data = await instant(
          () => setPlayers(prev => prev.map(p => (p.id === id ? { ...p, status: 'Upcoming', soldTo: undefined, soldPrice: undefined } : p))),
          () => apiPlayers.update(id, { status: 'Upcoming' })
        )
        notify(data.success ? 'Player restored to upcoming pool' : data.message || 'Could not reopen player')
      } catch {
        notify('Failed to re-auction player')
      } finally {
        loadState()
      }
    })
  }

  // Schedule & Toss Operations
  const handleAddMatch = async (m: {
    teamA: string
    teamB: string
    date: string
    venue?: string
    leagueMatches?: number // asked in the form the first time, when League Settings has no count yet
  }) => {
    return guardAuctioneer(async () => {
      try {
        const { leagueMatches: total, ...fixture } = m
        if (total) {
          const set = await apiLeague.updateSettings({ leagueMatches: total })
          if (!set.success) {
            notify(set.message || 'Could not save the number of league matches')
            return
          }
        }
        const data = await instant(
          () => {
            setMatches(prev => [...prev, {
              id: `pending_${Date.now()}`,
              matchNumber: prev.length + 1,
              stage: 'League Match',
              teamA: fixture.teamA,
              teamB: fixture.teamB,
              date: fixture.date,
              venue: fixture.venue || 'Main Stadium Arena',
              status: 'Scheduled'
            }])
            setAddMatchModalOpen(false)
          },
          () => apiMatches.create(fixture)
        )
        if (data.success) {
          notify(data.message || `Match fixture scheduled: ${m.teamA} vs ${m.teamB}`)
        } else {
          notify(data.message || 'Could not schedule match')
        }
      } catch {
        notify('Failed to schedule match')
      } finally {
        loadState()
      }
    })
  }

  const handleRoundRobin = async (data: { double: boolean; startDate: string; venue: string }) => {
    return guardAuctioneer(async () => {
      try {
        const res = await apiMatches.generateRoundRobin(data)
        notify(res.message)
        if (res.success) setRoundRobinOpen(false)
      } catch {
        notify('Failed to create the round robin')
      } finally {
        loadState()
      }
    })
  }

  const handleCreateKnockouts = async (data: { round: KnockoutRound; pairings: Pairing[]; date: string; venue: string }) => {
    return guardAuctioneer(async () => {
      try {
        const res = await apiMatches.createKnockouts(data)
        notify(res.message)
        if (res.success) setKnockoutRound(null)
      } catch {
        notify('Failed to create the knockout matches')
      } finally {
        loadState()
      }
    })
  }

  const handleDeleteMatch = async (id: string) => {
    guardAuctioneer(async () => {
      if (!confirm('Delete this match? Its toss and result will be lost.')) return
      try {
        const data = await instant(
          () => setMatches(prev => prev.filter(m => m.id !== id).map((m, i) => ({ ...m, matchNumber: i + 1 }))),
          () => apiMatches.delete(id)
        )
        notify(data.success ? 'Match fixture removed' : data.message || 'Could not delete match')
      } catch {
        notify('Failed to delete fixture')
      } finally {
        loadState()
      }
    })
  }

  const handleRecordToss = async (matchId: string, tossWinner: string, tossDecision: 'Bat' | 'Bowl') => {
    guardAuctioneer(async () => {
      // A quick toss with no fixture has nothing to save
      if (matchId === 'temp_toss') {
        notify(`${tossWinner} won the toss and chose to ${tossDecision}`)
        setTossModalMatch(null)
        return
      }
      try {
        const data = await instant(
          () => {
            setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, tossWinner, tossDecision, status: 'Toss Done' } : m)))
            setTossModalMatch(null)
          },
          () => apiMatches.recordToss(matchId, tossWinner, tossDecision)
        )
        if (data.success) {
          notify(data.message)
        } else {
          notify(data.message || 'Could not record toss')
        }
      } catch {
        notify('Failed to record toss')
      } finally {
        loadState()
      }
    })
  }

  const handleRecordResult = async (
    matchId: string,
    payload: Parameters<typeof apiMatches.recordResult>[1]
  ) => {
    guardAuctioneer(async () => {
      try {
        const data = await apiMatches.recordResult(matchId, payload)
        if (data.success) {
          notify(data.message)
          setResultModalMatch(null)
        } else {
          notify(data.message || 'Could not save result')
        }
      } catch {
        notify('Failed to save result')
      } finally {
        loadState()
      }
    })
  }

  const handleQuickToss = () => {
    guardAuctioneer(() => {
      const nextMatch = matches.find(m => m.status !== 'Completed')
      if (nextMatch) {
        setTossModalMatch(nextMatch)
      } else if (teams.length >= 2) {
        setTossModalMatch({
          id: 'temp_toss',
          matchNumber: 1,
          stage: 'Exhibition Match',
          teamA: teams[0].name,
          teamB: teams[1].name,
          date: new Date().toISOString().split('T')[0],
          venue: 'Premier Arena',
          status: 'Scheduled'
        })
      } else {
        notify('Register at least 2 teams to run a coin toss!')
      }
    })
  }

  // Keyboard shortcuts on the Auction page: S spin, 1-9 bid for team N, Enter sell, U unsold
  useEffect(() => {
    if (page !== 'auction' || anyModalOpen || !isAuctioneer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'enter' && el?.tagName === 'BUTTON') return // Enter on a focused button presses that button
      if (k === 's') { if (!current) handleSpin() }
      else if (k === 'u') handleMarkUnsold()
      else if (k === 'enter') handleAwardSell()
      else if (/^[1-9]$/.test(k) && teams[Number(k) - 1]) handleBid(teams[Number(k) - 1])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="app-shell">
      <Topbar
        page={page}
        setPage={setPage}
        leagueName={leagueName}
        season={season}
        onUpdateSeason={handleUpdateSeason}
        maxSquadSize={maxSquadSize}
        onUpdateSquadLimit={handleUpdateSquadLimit}
        isAuctioneer={isAuctioneer}
        setIsAuctioneer={handleSetAuctioneer}
        ownerTeamName={ownerTeam?.name || null}
        onOwnerLogout={handleOwnerLogout}
        onOpenAuth={() => setAuthModalOpen(true)}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onOpenSettings={() => guardAuctioneer(() => setSetupOpen(true))}
      />

      <main className="page-wrap">
        {page === 'home' && (
          <HomeView
            season={season}
            teamsCount={teams.length}
            playersCount={players.length}
            matchesCount={matches.length}
            maxSquadSize={maxSquadSize}
            defaultPurse={defaultPurse}
            onStart={() => setPage('auction')}
            onManageTeams={() => setPage('teams')}
            onManageSchedule={() => setPage('schedule')}
            onQuickToss={handleQuickToss}
          />
        )}

        {page === 'auction' && !isAuctioneer && (
          <SpectatorView
            players={players}
            teams={teams}
            current={current}
            bid={bid}
            minRaise={minRaise}
            leader={leader}
            liveSpin={liveSpin}
            maxSquadSize={maxSquadSize}
            ownerTeam={ownerTeam}
            onOwnerBid={handleOwnerBid}
            onUnlock={() => setAuthModalOpen(true)}
          />
        )}

        {page === 'auction' && isAuctioneer && (
          <AuctionView
            players={players}
            teams={teams}
            current={current}
            bid={bid}
            minRaise={minRaise}
            leader={leader}
            spinRequested={spinRequested}
            liveSpin={liveSpin}
            wheelScope={wheelScope}
            setWheelScope={setWheelScope}
            awardTeam={awardTeam}
            setAwardTeam={setAwardTeam}
            awardPrice={awardPrice}
            setAwardPrice={setAwardPrice}
            maxSquadSize={maxSquadSize}
            spin={handleSpin}
            nominate={handleNominate}
            makeBid={handleBid}
            awardSell={handleAwardSell}
            unsold={handleMarkUnsold}
            onAddPlayer={() => guardAuctioneer(() => setPlayerModalOpen(true))}
            onAddTeam={() => guardAuctioneer(() => setTeamModalOpen(true))}
            onAdjustBudget={t => guardAuctioneer(() => setBudgetModalTeam(t))}
            onDirectSell={handleOpenDirectSell}
            onReopenAllUnsold={handleReopenAllUnsold}
          />
        )}

        {page === 'teams' && (
          <TeamsView
            teams={teams}
            players={players}
            maxSquadSize={maxSquadSize}
            isAuctioneer={isAuctioneer}
            ownerTeamId={ownerTeamId}
            onAddTeam={() => guardAuctioneer(() => setTeamModalOpen(true))}
            onDeleteTeam={handleDeleteTeam}
            onAdjustBudget={t => guardAuctioneer(() => setBudgetModalTeam(t))}
            onOwnerLogin={t => guardAuctioneer(() => setOwnerLoginTeam(t))}
            onUploadLogo={handleUploadLogo}
            onRemoveLogo={handleRemoveLogo}
            notify={notify}
          />
        )}

        {page === 'players' && (
          <PlayersView
            players={players}
            search={search}
            setSearch={setSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            isAuctioneer={isAuctioneer}
            maxSquadSize={maxSquadSize}
            defaultPurse={defaultPurse}
            onOpenAuction={() => setPage('auction')}
            onAddPlayer={() => guardAuctioneer(() => setPlayerModalOpen(true))}
            onBulkImport={() => guardAuctioneer(() => setBulkModalOpen(true))}
            onDeletePlayer={handleDeletePlayer}
            onDeleteMany={handleDeletePlayers}
            onReopenPlayer={handleReopenPlayer}
            onDirectSell={handleOpenDirectSell}
            onNominate={id => {
              handleNominate(id)
              setPage('auction')
            }}
          />
        )}

        {['schedule', 'standings', 'results'].includes(page) && (
          <div className="segmented">
            {[
              { id: 'schedule', label: 'Fixtures' },
              { id: 'standings', label: 'Leaderboard' },
              { id: 'results', label: 'Auction Results' }
            ].map(tab => (
              <button key={tab.id} className={page === tab.id ? 'active' : ''} onClick={() => setPage(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {page === 'schedule' && (
          <ScheduleView
            matches={matches}
            teams={teams}
            filter={scheduleFilter}
            setFilter={setScheduleFilter}
            isAuctioneer={isAuctioneer}
            onAddMatch={() => guardAuctioneer(() => setAddMatchModalOpen(true))}
            onDeleteMatch={handleDeleteMatch}
            onOpenToss={m => guardAuctioneer(() => setTossModalMatch(m))}
            onOpenResult={m => guardAuctioneer(() => setResultModalMatch(m))}
            onQuickToss={handleQuickToss}
            leagueMatches={leagueMatches}
            knockout={knockout}
            onCreateKnockouts={(round, pairings) => guardAuctioneer(() => setKnockoutRound({ round, pairings }))}
            onRoundRobin={() => guardAuctioneer(() => setRoundRobinOpen(true))}
          />
        )}

        {page === 'standings' && (
          <StandingsView teams={teams} matches={matches} leagueMatches={leagueMatches} knockout={knockout} />
        )}

        {page === 'results' && (
          <ResultsView
            players={players}
            teams={teams}
            maxSquadSize={maxSquadSize}
            isAuctioneer={isAuctioneer}
            onReset={handleResetAuction}
          />
        )}
      </main>

      {/* --- ALL MODALS --- */}
      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onVerify={handleVerifyPin}
          onOwnerLogin={handleOwnerLogin}
          error={authError}
        />
      )}

      {directSellModalOpen && (
        <DirectSellModal
          players={players}
          teams={teams}
          maxSquadSize={maxSquadSize}
          initialPlayer={directSellPlayer}
          onClose={() => {
            setDirectSellModalOpen(false)
            setDirectSellPlayer(null)
          }}
          onSell={handleDirectSell}
        />
      )}

      {playerModalOpen && (
        <AddPlayerModal
          onClose={() => setPlayerModalOpen(false)}
          onAdd={handleAddPlayer}
          nextNumber={nextPlayerNumber}
        />
      )}

      {bulkModalOpen && (
        <BulkImportModal
          onClose={() => setBulkModalOpen(false)}
          onImport={handleBulkImport}
          existingNames={players.map(p => p.name)}
          nextNumber={nextPlayerNumber}
        />
      )}

      {teamModalOpen && (
        <AddTeamModal
          defaultPurse={defaultPurse}
          onClose={() => setTeamModalOpen(false)}
          onAdd={handleAddTeam}
        />
      )}

      {budgetModalTeam && (
        <AdjustBudgetModal
          team={budgetModalTeam}
          onClose={() => setBudgetModalTeam(null)}
          onAdjust={handleAdjustBudget}
        />
      )}

      {addMatchModalOpen && (
        <AddMatchModal
          teams={teams}
          matches={matches}
          leagueMatches={leagueMatches}
          oneMeeting={oneMeetingOnly(knockout)}
          onClose={() => setAddMatchModalOpen(false)}
          onAdd={handleAddMatch}
        />
      )}

      {roundRobinOpen && (
        <RoundRobinModal
          teams={teams}
          matches={matches}
          leagueMatches={leagueMatches}
          oneMeeting={oneMeetingOnly(knockout)}
          onClose={() => setRoundRobinOpen(false)}
          onGenerate={handleRoundRobin}
        />
      )}

      {knockoutRound && (
        <KnockoutModal
          round={knockoutRound.round}
          pairings={knockoutRound.pairings}
          onClose={() => setKnockoutRound(null)}
          onCreate={handleCreateKnockouts}
        />
      )}

      {tossModalMatch && (
        <TossModal
          match={tossModalMatch}
          onClose={() => setTossModalMatch(null)}
          onRecordToss={handleRecordToss}
        />
      )}

      {resultModalMatch && (
        <ResultModal
          match={resultModalMatch}
          onClose={() => setResultModalMatch(null)}
          onSave={handleRecordResult}
        />
      )}

      {ownerLoginTeam && (
        <OwnerLoginModal
          team={ownerLoginTeam}
          onClose={() => setOwnerLoginTeam(null)}
          onSave={handleSaveOwnerLogin}
        />
      )}

      {setupOpen && (
        <SetupModal
          leagueName={leagueName}
          season={season}
          defaultPurse={defaultPurse}
          maxSquadSize={maxSquadSize}
          leagueMatches={leagueMatches}
          knockout={knockout}
          onClose={() => setSetupOpen(false)}
          onSave={handleSaveLeagueSettings}
          onChangePin={handleChangePin}
        />
      )}

      <Toast message={toast} />
      <WinBanner celebration={celebration} />
    </div>
  )
}
