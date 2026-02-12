import { useState, useEffect } from 'react';
import { Activity, Target, TrendingUp, ChevronDown, ChevronUp, Trophy, Award, BarChart3, TrendingDown, AlertCircle, CheckCircle, Save, History, Download, Trash2, Filter } from 'lucide-react';
import { simulatePlayoffOdds, fetchLeagueDetails, type PlayoffOdds, type SleeperLeague } from '../services/sleeperApi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

interface PlayoffSimulatorProps {
  leagueId: string;
}

interface SavedSimulation {
  id: string;
  simulation_count: number;
  results: PlayoffOdds[];
  league_info: Partial<SleeperLeague>;
  notes: string | null;
  created_at: string;
}

export default function PlayoffSimulator({ leagueId }: PlayoffSimulatorProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [results, setResults] = useState<PlayoffOdds[]>([]);
  const [simulations, setSimulations] = useState<number>(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [leagueInfo, setLeagueInfo] = useState<SleeperLeague | null>(null);
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterMakePlayoffs, setFilterMakePlayoffs] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadLeagueInfo();
    if (user) {
      loadSavedSimulations();
    }
  }, [leagueId, user]);

  async function loadLeagueInfo() {
    try {
      const league = await fetchLeagueDetails(leagueId);
      setLeagueInfo(league);
    } catch (err) {
      console.error('Failed to load league info:', err);
    }
  }

  async function loadSavedSimulations() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('playoff_simulations')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSimulations(data || []);
    } catch (err) {
      console.error('Failed to load saved simulations:', err);
    }
  }

  async function saveSimulation() {
    if (!user || results.length === 0) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('playoff_simulations').insert({
        user_id: user.id,
        league_id: leagueId,
        simulation_count: simulations,
        results,
        league_info: leagueInfo ? {
          name: leagueInfo.name,
          season: leagueInfo.season,
          playoff_teams: leagueInfo.settings.playoff_teams,
        } : {},
        notes: notes.trim() || null,
      });

      if (error) throw error;

      showToast('Simulation saved successfully', 'success');
      setNotes('');
      await loadSavedSimulations();
    } catch (err) {
      console.error('Failed to save simulation:', err);
      showToast('Failed to save simulation', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function loadSimulation(simulation: SavedSimulation) {
    setResults(simulation.results);
    setSimulations(simulation.simulation_count);
    setShowHistory(false);
    showToast('Simulation loaded', 'info');
  }

  async function deleteSimulation(id: string) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('playoff_simulations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showToast('Simulation deleted', 'success');
      await loadSavedSimulations();
    } catch (err) {
      console.error('Failed to delete simulation:', err);
      showToast('Failed to delete simulation', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  }

  function exportResults() {
    if (results.length === 0) return;

    const csvContent = [
      ['Team', 'Record', 'Playoff %', 'Championship %', 'Bye %', 'Projected Wins', 'PF', 'PA'].join(','),
      ...results.map((team) =>
        [
          team.team_name,
          team.current_record,
          team.playoff_odds.toFixed(1),
          team.championship_odds.toFixed(1),
          team.bye_odds.toFixed(1),
          team.projected_wins.toFixed(1),
          team.points_for.toFixed(1),
          team.points_against.toFixed(1),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playoff-odds-${leagueInfo?.name || leagueId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Results exported', 'success');
  }

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

  function getFilteredResults(): PlayoffOdds[] {
    if (filterMakePlayoffs === 'all') return results;
    if (filterMakePlayoffs === 'high') return results.filter(t => t.playoff_odds >= 75);
    if (filterMakePlayoffs === 'medium') return results.filter(t => t.playoff_odds >= 25 && t.playoff_odds < 75);
    return results.filter(t => t.playoff_odds < 25);
  }

  const filteredResults = getFilteredResults();

  return (
    <div className="space-y-6">
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Simulation"
          message="Are you sure you want to delete this saved simulation? This action cannot be undone."
          onConfirm={() => deleteSimulation(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-7 h-7 text-[#00d4ff]" />
            <h2 className="text-2xl font-bold text-white">Playoff Odds Simulator</h2>
            {leagueInfo && (
              <span className="text-sm text-gray-400 ml-2">
                {leagueInfo.name} • {leagueInfo.season}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && savedSimulations.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 border border-gray-700"
              >
                <History className="w-4 h-4" />
                History ({savedSimulations.length})
              </button>
            )}
            {results.length > 0 && (
              <button
                onClick={exportResults}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2 border border-gray-700"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
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

        {showHistory && user && (
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Simulation History</h3>
            {savedSimulations.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No saved simulations yet</p>
            ) : (
              <div className="space-y-3">
                {savedSimulations.map((sim) => (
                  <div
                    key={sim.id}
                    className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-[#00d4ff] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white font-semibold">
                            {new Date(sim.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-sm text-gray-400">
                            {sim.simulation_count.toLocaleString()} simulations
                          </span>
                        </div>
                        {sim.notes && (
                          <p className="text-sm text-gray-400 mb-2">{sim.notes}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {sim.results.slice(0, 3).map((team) => (
                            <span key={team.roster_id} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">
                              {team.team_name}: {team.playoff_odds.toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => loadSimulation(sim)}
                          className="px-3 py-1.5 bg-[#00d4ff] text-white rounded hover:opacity-90 transition-opacity text-sm"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(sim.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {results.length > 0 && user && (
          <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Save Results</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes (optional)"
                className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
              <button
                onClick={saveSimulation}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-[#00d4ff] to-[#0099cc] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            {(() => {
              const championshipFavorite = [...results].sort((a, b) => b.championship_odds - a.championship_odds)[0];
              const playoffFavorite = [...results].sort((a, b) => b.playoff_odds - a.playoff_odds)[0];

              return (
                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 rounded-lg border border-yellow-500/30 p-6 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-bold text-white">Championship Favorite</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-yellow-500/20">
                      <div className="text-sm text-gray-400 mb-2">Most Likely Champion</div>
                      <div className="text-2xl font-bold text-yellow-400 mb-1">
                        {championshipFavorite.team_name}
                      </div>
                      <div className="text-lg text-white">
                        {championshipFavorite.championship_odds.toFixed(1)}% chance to win it all
                      </div>
                      <div className="text-sm text-gray-400 mt-2">
                        {championshipFavorite.current_record} • {championshipFavorite.playoff_odds.toFixed(1)}% playoff odds
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-[#00d4ff]/20">
                      <div className="text-sm text-gray-400 mb-2">Most Likely Playoff Team</div>
                      <div className="text-2xl font-bold text-[#00d4ff] mb-1">
                        {playoffFavorite.team_name}
                      </div>
                      <div className="text-lg text-white">
                        {playoffFavorite.playoff_odds.toFixed(1)}% chance to make playoffs
                      </div>
                      <div className="text-sm text-gray-400 mt-2">
                        {playoffFavorite.current_record} • {playoffFavorite.championship_odds.toFixed(1)}% title odds
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-white">Simulation Results</h3>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterMakePlayoffs}
                    onChange={(e) => setFilterMakePlayoffs(e.target.value as any)}
                    className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-[#00d4ff] transition-colors"
                  >
                    <option value="all">All Teams</option>
                    <option value="high">High Odds (≥75%)</option>
                    <option value="medium">Medium Odds (25-75%)</option>
                    <option value="low">Low Odds (&lt;25%)</option>
                  </select>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {filteredResults.length} of {results.length} teams • {simulations.toLocaleString()} simulations
              </div>
            </div>

            {filteredResults.map((team, index) => (
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
