import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, Minus, RefreshCw, Filter, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PlayerTrend {
  player_id: string;
  player_name: string;
  player_position: string;
  team: string | null;
  value_now: number;
  value_7d: number;
  value_30d: number;
  change_7d: number;
  change_30d: number;
  change_7d_pct: number;
  change_30d_pct: number;
  volatility: number;
  tag: 'buy_low' | 'sell_high' | 'rising' | 'falling' | 'stable';
  signal_strength: number;
  computed_at: string;
}

type TrendTag = 'buy_low' | 'sell_high' | 'rising' | 'falling';

interface MarketTrendsProps {
  onSelectPlayer?: (playerId: string) => void;
}

export default function MarketTrends({ onSelectPlayer }: MarketTrendsProps) {
  const [activeTab, setActiveTab] = useState<TrendTag>('buy_low');
  const [trends, setTrends] = useState<PlayerTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastComputed, setLastComputed] = useState<string | null>(null);

  useEffect(() => {
    fetchTrends();
  }, [activeTab, positionFilter]);

  const fetchTrends = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        tag: activeTab,
        limit: '50',
      });

      if (positionFilter !== 'all') {
        params.append('position', positionFilter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-trends?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch trends');
      }

      setTrends(data.trends || []);
      setLastComputed(data.last_computed);
    } catch (err) {
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTrendConfig = (tag: TrendTag) => {
    switch (tag) {
      case 'buy_low':
        return {
          label: 'Buy Low',
          color: 'green',
          bgGradient: 'from-green-500 to-emerald-600',
          icon: TrendingDown,
          description: 'Players whose values have dropped significantly',
        };
      case 'sell_high':
        return {
          label: 'Sell High',
          color: 'red',
          bgGradient: 'from-red-500 to-rose-600',
          icon: TrendingUp,
          description: 'Players whose values have spiked recently',
        };
      case 'rising':
        return {
          label: 'Rising',
          color: 'blue',
          bgGradient: 'from-blue-500 to-indigo-600',
          icon: ArrowUp,
          description: 'Players with steady upward momentum',
        };
      case 'falling':
        return {
          label: 'Falling',
          color: 'orange',
          bgGradient: 'from-orange-500 to-amber-600',
          icon: ArrowDown,
          description: 'Players with declining values',
        };
    }
  };

  const filteredTrends = trends.filter(trend => {
    if (!searchQuery) return true;
    return trend.player_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const config = getTrendConfig(activeTab);
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Dynasty Market Trends</h2>
            <p className="text-gray-600 mt-1">
              Real-time buy-low and sell-high opportunities based on value movement
            </p>
          </div>
          <button
            onClick={fetchTrends}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {lastComputed && (
          <p className="text-sm text-gray-500">
            Last updated: {new Date(lastComputed).toLocaleString()}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-4 gap-0">
          {(['buy_low', 'sell_high', 'rising', 'falling'] as TrendTag[]).map(tag => {
            const tabConfig = getTrendConfig(tag);
            const TabIcon = tabConfig.icon;
            const isActive = activeTab === tag;

            return (
              <button
                key={tag}
                onClick={() => setActiveTab(tag)}
                className={`px-6 py-4 text-center border-b-4 transition-all ${
                  isActive
                    ? `border-${tabConfig.color}-600 bg-${tabConfig.color}-50`
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TabIcon className={`w-5 h-5 ${isActive ? `text-${tabConfig.color}-600` : 'text-gray-400'}`} />
                  <span className={`font-bold ${isActive ? `text-${tabConfig.color}-700` : 'text-gray-600'}`}>
                    {tabConfig.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{tabConfig.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Position Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredTrends.length} players
          </div>
        </div>
      </div>

      {/* Trends Grid */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market trends...</p>
        </div>
      ) : filteredTrends.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No trends found</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrends.map((trend) => (
            <TrendCard
              key={trend.player_id}
              trend={trend}
              onSelect={onSelectPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TrendCardProps {
  trend: PlayerTrend;
  onSelect?: (playerId: string) => void;
}

function TrendCard({ trend, onSelect }: TrendCardProps) {
  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'buy_low': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
      case 'sell_high': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
      case 'rising': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      case 'falling': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  const colors = getTagColor(trend.tag);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-2 ${colors.border} p-4 hover:shadow-md transition-shadow cursor-pointer`}
      onClick={() => onSelect?.(trend.player_id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{trend.player_name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-semibold text-gray-600">{trend.player_position}</span>
            {trend.team && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600">{trend.team}</span>
              </>
            )}
          </div>
        </div>
        <div className={`px-2 py-1 ${colors.bg} ${colors.text} rounded-full text-xs font-bold`}>
          {trend.signal_strength}%
        </div>
      </div>

      {/* Current Value */}
      <div className="mb-3">
        <div className="text-sm text-gray-500">Current Value</div>
        <div className="text-2xl font-bold text-gray-900">{trend.value_now.toLocaleString()}</div>
      </div>

      {/* Changes */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`${colors.bg} rounded-lg p-2`}>
          <div className="text-xs text-gray-600 mb-1">7-Day Change</div>
          <div className={`text-sm font-bold ${colors.text} flex items-center gap-1`}>
            {trend.change_7d > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {trend.change_7d > 0 ? '+' : ''}{trend.change_7d.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {trend.change_7d_pct > 0 ? '+' : ''}{trend.change_7d_pct}%
          </div>
        </div>

        <div className={`${colors.bg} rounded-lg p-2`}>
          <div className="text-xs text-gray-600 mb-1">30-Day Change</div>
          <div className={`text-sm font-bold ${colors.text} flex items-center gap-1`}>
            {trend.change_30d > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {trend.change_30d > 0 ? '+' : ''}{trend.change_30d.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {trend.change_30d_pct > 0 ? '+' : ''}{trend.change_30d_pct}%
          </div>
        </div>
      </div>

      {/* Volatility */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span>Volatility</span>
        <span className="font-semibold">{trend.volatility.toLocaleString()}</span>
      </div>
    </div>
  );
}
