import { useState } from 'react';
import { Activity, Target, TrendingUp, ChevronDown, ChevronUp, Trophy, Award, BarChart3, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { simulatePlayoffOdds, type PlayoffOdds } from '../services/sleeperApi';

interface PlayoffSimulatorProps {
  leagueId: string;
}

export default function PlayoffSimulator({ leagueId }: PlayoffSimulatorProps) {
  const [results, setResults] = useState<PlayoffOdds[]>([]);
  const [simulations, setSimulations] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const data = await simulatePlayoffOdds(leagueId, simulations);
      data.sort((a, b) => b.playoff_odds - a.playoff_odds);
      setResults(data);
    } catch (err) {
      console.error('Failed to simulate playoff odds:', err);
      setError('Failed to run simulation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getOddsColor(odds: number): string {
    if (odds >= 75) return 'text-green-400';
    if (odds >= 50) return 'text-yellow-400';
    if (odds >= 25) return 'text-orange-400';
    return 'text-red-400';
  }

  function getOddsBgColor(odds: number): string {
    if (odds >= 75) return 'bg-green-500';
    if (odds >= 50) return 'bg-yellow-500';
    if (odds >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function getSeedBadgeColor(seed: number): string {
    if (seed === 1) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    if (seed === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400';
    if (seed === 3) return 'bg-gradient-to-r from-orange-600 to-orange-700';
    if (seed <= 6) return 'bg-[#00d4ff]';
    return 'bg-gray-600';
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-7 h-7 text-[#00d4ff]" />
          <h2 className="text-2xl font-bold text-white">Playoff Odds Simulator</h2>
        </div>

        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Number of Simulations
              </label>
              <select
                value={simulations}
                onChange={(e) => setSimulations(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00d4ff] transition-colors"
                disabled={loading}
              >
                <option value={100}>100 (Fast)</option>
                <option value={1000}>1,000 (Recommended)</option>
                <option value={10000}>10,000 (Accurate)</option>
              </select>
            </div>
            <div className="sm:pt-7 w-full sm:w-auto">
              <button
                onClick={runSimulation}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Simulation Results</h3>
              <div className="text-sm text-gray-400">
                Based on {simulations.toLocaleString()} simulations
              </div>
            </div>

            {results.map((team, index) => (
              <div
                key={team.roster_id}
                className="bg-gray-800 rounded-lg border border-gray-700 hover:border-[#00d4ff] transition-all duration-300"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                        team.current_seed <= 6 ? 'border-[#00d4ff] bg-[#00d4ff]/10' : 'border-gray-700 bg-gray-900'
                      }`}>
                        <span className={`font-bold ${team.current_seed <= 6 ? 'text-[#00d4ff]' : 'text-gray-400'}`}>
                          #{team.current_seed}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-white">{team.team_name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                          <span>Record: {team.current_record}</span>
                          <span>•</span>
                          <span>Proj: {team.projected_wins.toFixed(1)} W</span>
                          <span>•</span>
                          <span>{team.points_for.toFixed(1)} PF</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedTeam(expandedTeam === team.roster_id ? null : team.roster_id)}
                      className="text-gray-400 hover:text-[#00d4ff] transition-colors ml-4"
                    >
                      {expandedTeam === team.roster_id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {(team.clinch_scenario || team.elimination_scenario) && (
                    <div className={`mb-4 p-3 rounded-lg border ${
                      team.clinch_scenario
                        ? 'bg-green-900/20 border-green-500/50'
                        : 'bg-red-900/20 border-red-500/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        {team.clinch_scenario ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-semibold ${
                          team.clinch_scenario ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {team.clinch_scenario || team.elimination_scenario}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                          <Target className="w-4 h-4" />
                          Make Playoffs
                        </div>
                        <span className={`font-bold ${getOddsColor(team.playoff_odds)}`}>
                          {team.playoff_odds.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getOddsBgColor(team.playoff_odds)} transition-all duration-500`}
                          style={{ width: `${Math.min(team.playoff_odds, 100)}%` }}
                        />
                      </div>
                    </div>

                    {team.bye_odds > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                            <Award className="w-4 h-4" />
                            First Round Bye
                          </div>
                          <span className={`font-bold ${getOddsColor(team.bye_odds)}`}>
                            {team.bye_odds.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full ${getOddsBgColor(team.bye_odds)} transition-all duration-500`}
                            style={{ width: `${Math.min(team.bye_odds, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                          <Trophy className="w-4 h-4" />
                          Win Championship
                        </div>
                        <span className={`font-bold ${getOddsColor(team.championship_odds)}`}>
                          {team.championship_odds.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${getOddsBgColor(team.championship_odds)} transition-all duration-500`}
                          style={{ width: `${Math.min(team.championship_odds, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {expandedTeam === team.roster_id && (
                  <div className="border-t border-gray-700 p-5 bg-gray-900/50">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-[#00d4ff]" />
                          Seeding Probability
                        </h5>
                        <div className="space-y-2">
                          {team.seed_distribution
                            .map((pct, idx) => ({ seed: idx + 1, pct }))
                            .filter((s) => s.pct > 0.5)
                            .sort((a, b) => b.pct - a.pct)
                            .slice(0, 6)
                            .map((seedData) => (
                              <div key={seedData.seed} className="flex items-center gap-3">
                                <div className={`px-2 py-1 rounded text-xs font-bold text-white min-w-[60px] text-center ${
                                  getSeedBadgeColor(seedData.seed)
                                }`}>
                                  Seed {seedData.seed}
                                </div>
                                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-full bg-[#00d4ff] transition-all duration-500"
                                    style={{ width: `${seedData.pct}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-gray-300 min-w-[50px] text-right">
                                  {seedData.pct.toFixed(1)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#00d4ff]" />
                          Projected Win Distribution
                        </h5>
                        <div className="space-y-2">
                          {team.projected_record_distribution.slice(0, 6).map((dist) => (
                            <div key={dist.wins} className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-gray-300 min-w-[70px]">
                                {dist.wins} wins
                              </span>
                              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-green-500 transition-all duration-500"
                                  style={{ width: `${dist.percentage}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-gray-300 min-w-[50px] text-right">
                                {dist.percentage.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4">
                      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 mb-1">Points For</div>
                        <div className="text-lg font-bold text-white">{team.points_for.toFixed(1)}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 mb-1">Points Against</div>
                        <div className="text-lg font-bold text-white">{team.points_against.toFixed(1)}</div>
                      </div>
                      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" />
                          Strength of Schedule
                        </div>
                        <div className="text-lg font-bold text-white">{team.strength_of_schedule.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Ready to simulate playoff odds</p>
            <p className="text-sm">Select the number of simulations and click "Run Simulation"</p>
          </div>
        )}
      </div>
    </div>
  );
}
