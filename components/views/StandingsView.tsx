'use client'

import { useMemo } from 'react'
import { Trophy } from 'lucide-react'
import type { Match, Team } from '@/lib/server/db'
import { computeStandings, WIN_POINTS, TIE_POINTS } from '@/lib/shared/standings'
import { isLeagueMatch, playoffPhase, qualifiersFor, type KnockoutFormat } from '@/lib/shared/playoffs'

export function StandingsView({
  teams,
  matches: allMatches,
  leagueMatches,
  knockout
}: {
  teams: Team[]
  matches: Match[]
  leagueMatches: number | null
  knockout: KnockoutFormat
}) {
  const QUALIFIERS = qualifiersFor(knockout)
  // Semi-finals and the final do not count towards the table
  const matches = useMemo(() => allMatches.filter(isLeagueMatch), [allMatches])
  const rows = useMemo(() => computeStandings(teams, matches), [teams, matches])
  const completed = matches.filter(m => m.status === 'Completed').length
  const phase = useMemo(() => playoffPhase(teams, allMatches, leagueMatches, knockout), [teams, allMatches, leagueMatches, knockout])
  const recent = useMemo(
    () => matches.filter(m => m.status === 'Completed' && m.result).slice(-5).reverse(),
    [matches]
  )

  return (
    <div>
      <div className="page-heading">
        <div>
          <span className="section-kicker">POINTS TABLE · {completed}/{leagueMatches || matches.length} LEAGUE MATCHES PLAYED</span>
          <h2>League <em>leaderboard</em></h2>
        </div>
      </div>

      {phase.phase === 'done' && (
        <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={18} style={{ color: 'var(--gold)' }} /> <b>{phase.champion}</b> won the final - season champions!
        </div>
      )}

      {teams.length === 0 ? (
        <div className="empty-state"><h3>No franchises yet</h3><p>Register teams to see the leaderboard.</p></div>
      ) : (
        <div className="standings-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Team</th>
                <th title="Played">P</th>
                <th title="Won">W</th>
                <th title="Lost">L</th>
                <th title="Tied" className="hide-sm">T</th>
                <th title="No result" className="hide-sm">NR</th>
                <th title="Net run rate">NRR</th>
                <th title="Points">Pts</th>
                <th className="hide-sm">Form</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.team.id} className={i < QUALIFIERS && r.played > 0 ? 'qualify' : ''}>
                  <td>{i + 1}</td>
                  <td className="left">
                    <span className="team-dot" style={{ background: r.team.color, marginRight: 8 }} />
                    <b>{r.team.name}</b>
                  </td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.lost}</td>
                  <td className="hide-sm">{r.tied}</td>
                  <td className="hide-sm">{r.noResult}</td>
                  <td className={r.nrr > 0 ? 'pos' : r.nrr < 0 ? 'neg' : ''}>
                    {r.played ? `${r.nrr >= 0 ? '+' : ''}${r.nrr.toFixed(3)}` : '0.000'}
                  </td>
                  <td className="pts">{r.points}</td>
                  <td className="hide-sm">
                    {r.form.slice(-5).map((f, k) => (
                      <span key={k} className={`form-chip f-${f}`}>{f}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 && (
        <div className="recent-results">
          <span className="section-kicker"><Trophy size={12} /> LATEST RESULTS</span>
          {recent.map(m => (
            <div key={m.id} className="recent-row">
              <span>#{m.matchNumber} {m.teamA} vs {m.teamB}</span>
              <b>{m.result}</b>
            </div>
          ))}
        </div>
      )}

      <p className="standings-note">
        Win = {WIN_POINTS} pts · Tie / No result = {TIE_POINTS} pt each · Ranking: points, then net run rate (NRR), then wins.
        NRR = (runs scored ÷ overs faced) − (runs conceded ÷ overs bowled); a side bowled out is charged its full quota of overs.
        Top {QUALIFIERS} are highlighted: {knockout === 'semis' ? 'they play the semi-finals (1st v 4th, 2nd v 3rd)' : 'they play the final'}.
        A tied or abandoned knockout match sends the higher-placed team through.
      </p>
    </div>
  )
}
