import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, X } from 'lucide-react';

interface PlayerTrend {
  player_id: string;
  player_name: string;
  player_position: string;
  team: string | null;
  value_now: number;
  change_30d: number;
  tag: 'buy_low' | 'sell_high' | 'rising' | 'falling' | 'stable';
  signal_strength: number;
}

interface MarketAlertsProps {
  rosterPlayerIds: string[];
  onViewMarket?: () => void;
}

export default function MarketAlerts({ rosterPlayerIds, onViewMarket }: MarketAlertsProps) {
  const [sellHighPlayers, setSellHighPlayers] = useState<PlayerTrend[]>([]);
  const [buyLowTargets, setBuyLowTargets] = useState<PlayerTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchMarketData();
  }, [rosterPlayerIds]);

  const fetchMarketData = async () => {
    if (rosterPlayerIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const sellHighResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trends?tag=sell_high&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const sellHighData = await sellHighResponse.json();
      const sellHighOnRoster = (sellHighData.trends || []).filter(
        (trend: PlayerTrend) => rosterPlayerIds.includes(trend.player_id)
      );

      setSellHighPlayers(sellHighOnRoster.slice(0, 3));

      const buyLowResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trends?tag=buy_low&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const buyLowData = await buyLowResponse.json();
      const buyLowTargets = (buyLowData.trends || [])
        .filter((trend: PlayerTrend) => !rosterPlayerIds.includes(trend.player_id))
        .slice(0, 3);

      setBuyLowTargets(buyLowTargets);
    } catch (err) {
      console.error('Error fetching market alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || dismissed) return null;
  if (sellHighPlayers.length === 0 && buyLowTargets.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-900">Market Opportunities</h3>
            <p className="text-sm text-gray-600">
              Based on current dynasty market trends
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sell High */}
        {sellHighPlayers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-red-600" />
              <h4 className="font-bold text-gray-900">
                {sellHighPlayers.length} Sell-High on Roster
              </h4>
            </div>
            <div className="space-y-2">
              {sellHighPlayers.map((player) => (
                <div
                  key={player.player_id}
                  className="bg-white rounded-lg p-3 border border-red-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {player.player_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.player_position} • {player.team || 'FA'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">
                        +{player.change_30d.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">30d change</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buy Low */}
        {buyLowTargets.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <h4 className="font-bold text-gray-900">
                {buyLowTargets.length} Buy-Low Targets
              </h4>
            </div>
            <div className="space-y-2">
              {buyLowTargets.map((player) => (
                <div
                  key={player.player_id}
                  className="bg-white rounded-lg p-3 border border-green-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {player.player_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {player.player_position} • {player.team || 'FA'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600">
                        {player.change_30d.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">30d change</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {onViewMarket && (
        <div className="mt-4 text-center">
          <button
            onClick={onViewMarket}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
          >
            View Full Market Trends
          </button>
        </div>
      )}
    </div>
  );
}
