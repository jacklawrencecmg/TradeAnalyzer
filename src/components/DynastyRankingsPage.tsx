import { useEffect, useState } from 'react';
import { TrendingUp, Calendar, Search, AlertCircle } from 'lucide-react';
import { Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { generateRankingsMetaTags, generatePlayerSlug } from '../lib/seo/meta';
import { generateRankingsStructuredData, injectStructuredData } from '../lib/seo/structuredData';
import { TableSkeleton } from './LoadingSkeleton';

interface RankedPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  age?: number;
  fdp_value: number;
  dynasty_rank: number;
  value_change_7d?: number;
}

export function DynastyRankingsPage() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    const metaTags = generateRankingsMetaTags('dynasty');
    document.title = metaTags.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', metaTags.description);
    }

    const structuredData = generateRankingsStructuredData('dynasty');
    injectStructuredData(structuredData);

    loadRankings();
  }, []);

  async function loadRankings() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('latest_player_values')
        .select('player_id, player_name, position, team, base_value, adjusted_value, rank_overall, updated_at')
        .in('position', ['QB', 'RB', 'WR', 'TE', 'LB', 'DL', 'DB'])
        .order('base_value', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const enriched = (data || []).map((p: any, index: number) => ({
        player_id: p.player_id,
        full_name: p.player_name || 'Unknown',
        position: p.position,
        team: p.team,
        fdp_value: p.adjusted_value || p.base_value || 0,
        dynasty_rank: index + 1,
        value_change_7d: undefined,
      }));

      setPlayers(enriched);

      if (data && data.length > 0 && data[0].updated_at) {
        setLastUpdated(new Date(data[0].updated_at));
      }
    } catch (err) {
      console.error('Error loading rankings:', err);
      setError('Failed to load rankings. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = players.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-7xl mx-auto">
          <TableSkeleton rows={20} cols={7} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <span className="text-fdp-text-1">Dynasty Rankings</span>
        </nav>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h1 className="text-4xl font-bold text-fdp-text-1 mb-4">
            Dynasty Rankings 2026 | Top 1000 Player Values
          </h1>
          <p className="text-lg text-fdp-text-2 mb-4">
            Complete dynasty fantasy football rankings for 2026 featuring the top 1000 players with accurate trade values, position ranks, and tier analysis. Our proprietary FDP algorithm combines production metrics, age curves, team situation, and real-time market consensus to deliver the most accurate dynasty player values available.
          </p>
          <p className="text-fdp-text-3 mb-6">
            Rankings are updated daily to reflect player performance, injuries, team changes, and market trends. Use these values to evaluate trades, plan draft strategy, and optimize your dynasty roster construction.
          </p>

          <div className="flex items-center gap-2 text-sm text-fdp-text-3">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {lastUpdated.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-fdp-text-3" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {['ALL', 'QB', 'RB', 'WR', 'TE', 'LB', 'DL', 'DB'].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    positionFilter === pos
                      ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                      : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl border border-fdp-border-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-fdp-surface-2 border-b border-fdp-border-1">
                <tr>
                  <th className="text-left p-4 text-fdp-text-2 font-semibold">Rank</th>
                  <th className="text-left p-4 text-fdp-text-2 font-semibold">Player</th>
                  <th className="text-left p-4 text-fdp-text-2 font-semibold">Team</th>
                  <th className="text-left p-4 text-fdp-text-2 font-semibold">Position</th>
                  <th className="text-right p-4 text-fdp-text-2 font-semibold">Age</th>
                  <th className="text-right p-4 text-fdp-text-2 font-semibold">Dynasty Value</th>
                  <th className="text-right p-4 text-fdp-text-2 font-semibold">7D Change</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-fdp-neg" />
                        <p className="text-fdp-text-2">{error}</p>
                        <button
                          onClick={loadRankings}
                          className="px-4 py-2 bg-fdp-accent-1 text-fdp-bg-0 rounded-lg font-semibold hover:opacity-90 transition-opacity"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-fdp-text-3">
                      {searchTerm || positionFilter !== 'ALL'
                        ? 'No players match your filters.'
                        : 'No rankings data available.'}
                    </td>
                  </tr>
                ) : null}
                {filteredPlayers.map((player, index) => (
                  <tr
                    key={player.player_id}
                    className="border-b border-fdp-border-1 hover:bg-fdp-surface-2 transition-colors"
                  >
                    <td className="p-4 text-fdp-text-1 font-semibold">
                      {player.dynasty_rank}
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/dynasty-value/${generatePlayerSlug(player.full_name)}`}
                        className="text-fdp-text-1 font-semibold hover:text-fdp-accent-1 transition-colors"
                      >
                        {player.full_name}
                      </Link>
                    </td>
                    <td className="p-4 text-fdp-text-2">{player.team || 'FA'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-fdp-surface-2 text-fdp-text-1 rounded text-sm font-semibold">
                        {player.position}
                      </span>
                    </td>
                    <td className="p-4 text-right text-fdp-text-2">{player.age || '-'}</td>
                    <td className="p-4 text-right">
                      <span className="text-fdp-accent-1 font-bold text-lg">
                        {player.fdp_value}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {player.value_change_7d !== undefined && player.value_change_7d !== 0 ? (
                        <span className={`flex items-center justify-end gap-1 ${
                          player.value_change_7d > 0 ? 'text-fdp-pos' : 'text-fdp-neg'
                        }`}>
                          {player.value_change_7d > 0 ? '+' : ''}{player.value_change_7d}
                          {player.value_change_7d > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingUp className="w-4 h-4 rotate-180" />
                          )}
                        </span>
                      ) : (
                        <span className="text-fdp-text-3">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">
            How to Use Dynasty Rankings
          </h2>
          <div className="prose prose-invert max-w-none text-fdp-text-2 space-y-4">
            <p>
              Dynasty fantasy football rankings represent the long-term value of players across multiple seasons. Unlike redraft rankings that focus on a single year, dynasty values account for age, career trajectory, and future potential.
            </p>
            <p>
              <strong>Trade Evaluation:</strong> Use these rankings to assess trade fairness. Players with similar values are generally equal trade partners, though league settings and roster construction may adjust relative value.
            </p>
            <p>
              <strong>Draft Strategy:</strong> In startup drafts, target players ranked higher than their average draft position (ADP). In rookie drafts, compare pick values to veteran player rankings to determine optimal trade-up or trade-back opportunities.
            </p>
            <p>
              <strong>Roster Management:</strong> Regularly compare your roster values against league averages. Teams with declining asset values should consider rebuilding, while contenders should maximize win-now value.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            to="/dynasty-superflex-rankings"
            className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
          >
            <h3 className="text-xl font-bold text-fdp-text-1 mb-2">Superflex Rankings</h3>
            <p className="text-fdp-text-3">QB premium dynasty values for superflex leagues</p>
          </Link>

          <Link
            to="/dynasty-rookie-rankings"
            className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
          >
            <h3 className="text-xl font-bold text-fdp-text-1 mb-2">Rookie Rankings</h3>
            <p className="text-fdp-text-3">Dynasty rookie draft pick values by round</p>
          </Link>

          <Link
            to="/trade-calculator"
            className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
          >
            <h3 className="text-xl font-bold text-fdp-text-1 mb-2">Trade Calculator</h3>
            <p className="text-fdp-text-3">Evaluate dynasty trades with our analyzer</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
