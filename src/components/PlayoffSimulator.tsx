import { useState } from 'react';
import { Activity, Target, TrendingUp } from 'lucide-react';
import { simulatePlayoffOdds, type PlayoffOdds } from '../services/sleeperApi';

interface PlayoffSimulatorProps {
  leagueId: string;
}

export default function PlayoffSimulator({ leagueId }: PlayoffSimulatorProps) {
  const [results, setResults] = useState<PlayoffOdds[]>([]);
  const [simulations, setSimulations] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                className="bg-gray-800 rounded-lg border border-gray-700 p-5 hover:border-[#00d4ff] transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-gray-900 rounded-full border border-gray-700">
                      <span className="text-gray-400 font-bold">{index + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{team.team_name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span>Record: {team.current_record}</span>
                        <span>•</span>
                        <span>Projected: {team.projected_wins.toFixed(1)} wins</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <Target className="w-4 h-4" />
                        Playoff Odds
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

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                        <TrendingUp className="w-4 h-4" />
                        Championship Odds
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
