import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface ValueHistory {
  recorded_at: string;
  value: number;
}

interface PlayerTrend {
  player_id: string;
  player_name: string;
  position: string;
  current_value: number;
  history: ValueHistory[];
  change_7d: number;
  change_30d: number;
  trend: 'up' | 'down' | 'stable';
}

interface ValueTrendTrackerProps {
  leagueId: string;
}

export default function ValueTrendTracker({ leagueId }: ValueTrendTrackerProps) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [trends, setTrends] = useState<PlayerTrend[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    loadTrends();
  }, [leagueId]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const { data: history, error } = await supabase
        .from('player_values_history')
        .select('*')
        .eq('league_id', leagueId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;

      const playerMap = new Map<string, ValueHistory[]>();
      (history || []).forEach(record => {
        if (!playerMap.has(record.player_id)) {
          playerMap.set(record.player_id, []);
        }
        playerMap.get(record.player_id)!.push({
          recorded_at: record.recorded_at,
          value: record.value
        });
      });

      const trendData: PlayerTrend[] = [];
      for (const [playerId, values] of playerMap.entries()) {
        if (values.length < 2) continue;

        const sortedValues = values.sort((a, b) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );

        const current = sortedValues[0].value;
        const sevenDaysAgo = sortedValues.find(v =>
          (Date.now() - new Date(v.recorded_at).getTime()) >= 7 * 24 * 60 * 60 * 1000
        );
        const thirtyDaysAgo = sortedValues.find(v =>
          (Date.now() - new Date(v.recorded_at).getTime()) >= 30 * 24 * 60 * 60 * 1000
        );

        const change7d = sevenDaysAgo ? current - sevenDaysAgo.value : 0;
        const change30d = thirtyDaysAgo ? current - thirtyDaysAgo.value : 0;

        const latestRecord = history?.find(h => h.player_id === playerId);

        trendData.push({
          player_id: playerId,
          player_name: latestRecord?.player_name || 'Unknown',
          position: latestRecord?.position || 'N/A',
          current_value: current,
          history: sortedValues,
          change_7d: change7d,
          change_30d: change30d,
          trend: change30d > 100 ? 'up' : change30d < -100 ? 'down' : 'stable'
        });
      }

      setTrends(trendData.sort((a, b) => Math.abs(b.change_30d) - Math.abs(a.change_30d)));
    } catch (error) {
      console.error('Error loading trends:', error);
    }
    setLoading(false);
  };

  const trackPlayer = async (playerName: string, playerId: string, position: string) => {
    try {
      const value = await getPlayerValue(playerId);

      await supabase.from('player_values_history').insert({
        player_id: playerId,
        player_name: playerName,
        position,
        value,
        league_id: leagueId
      });

      await loadTrends();
    } catch (error) {
      console.error('Error tracking player:', error);
    }
  };

  const filteredTrends = trends.filter(t =>
    t.player_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Value Trend Tracker</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tracked players..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={loadTrends}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Trends'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading trends...</p>
          </div>
        ) : trends.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No trend data available yet</p>
            <p className="text-gray-500 text-sm">Player values will be tracked automatically over time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrends.map(trend => (
              <div
                key={trend.player_id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{trend.player_name}</h3>
                        <p className="text-gray-400">{trend.position}</p>
                      </div>
                      {trend.trend === 'up' && (
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      )}
                      {trend.trend === 'down' && (
                        <TrendingDown className="w-6 h-6 text-red-400" />
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Current Value</p>
                        <p className="text-2xl font-bold">{trend.current_value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">7-Day Change</p>
                        <p className={`text-2xl font-bold ${
                          trend.change_7d > 0 ? 'text-green-400' :
                          trend.change_7d < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {trend.change_7d > 0 ? '+' : ''}{trend.change_7d.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">30-Day Change</p>
                        <p className={`text-2xl font-bold ${
                          trend.change_30d > 0 ? 'text-green-400' :
                          trend.change_30d < 0 ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {trend.change_30d > 0 ? '+' : ''}{trend.change_30d.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 bg-gray-700/30 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Value History</p>
                      <div className="flex gap-2 overflow-x-auto">
                        {trend.history.slice(0, 10).map((point, index) => (
                          <div key={index} className="flex-shrink-0 text-center">
                            <p className="text-xs text-gray-500 mb-1">
                              {new Date(point.recorded_at).toLocaleDateString()}
                            </p>
                            <p className="text-sm font-semibold">{point.value.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
