import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

interface Player {
  name: string;
  team: string;
  position: string;
  stats: {
    label: string;
    value: number;
    max?: number;
  }[];
  value?: number;
  trend?: 'up' | 'down' | 'stable';
}

interface PlayerComparisonProps {
  player1: Player;
  player2: Player;
  onClose: () => void;
}

export function PlayerComparison({ player1, player2, onClose }: PlayerComparisonProps) {
  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getValueDifference = () => {
    if (!player1.value || !player2.value) return null;
    const diff = player1.value - player2.value;
    return {
      amount: Math.abs(diff),
      winner: diff > 0 ? player1.name : player2.name,
      percentage: ((Math.abs(diff) / Math.max(player1.value, player2.value)) * 100).toFixed(1)
    };
  };

  const valueDiff = getValueDifference();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-auto shadow-2xl">
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700 p-6 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Player Comparison</h2>
            <p className="text-gray-400 text-sm mt-1">Side-by-side statistical analysis</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00d4ff] to-[#0099cc] rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {player1.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{player1.name}</h3>
                  <p className="text-gray-400">{player1.team} • {player1.position}</p>
                </div>
                {getTrendIcon(player1.trend)}
              </div>
              {player1.value && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Player Value</div>
                  <div className="text-3xl font-bold text-[#00d4ff]">{player1.value}</div>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {player2.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{player2.name}</h3>
                  <p className="text-gray-400">{player2.team} • {player2.position}</p>
                </div>
                {getTrendIcon(player2.trend)}
              </div>
              {player2.value && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Player Value</div>
                  <div className="text-3xl font-bold text-purple-500">{player2.value}</div>
                </div>
              )}
            </div>
          </div>

          {valueDiff && (
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-xl p-4 border border-gray-700 mb-6">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">Value Difference</div>
                <div className="text-2xl font-bold text-white">
                  {valueDiff.amount} points ({valueDiff.percentage}%)
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  <span className="text-[#00d4ff] font-semibold">{valueDiff.winner}</span> has higher value
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white">Statistical Comparison</h4>

            {player1.stats.map((stat, index) => {
              const stat2 = player2.stats[index];
              const maxValue = Math.max(stat.max || stat.value, stat2?.max || stat2?.value || 0);

              return (
                <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm font-semibold text-gray-300 mb-3 text-center">
                    {stat.label}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-[#00d4ff] mb-2 text-center">
                        {stat.value}
                      </div>
                      <ProgressBar
                        value={stat.value}
                        max={maxValue}
                        color="blue"
                        size="sm"
                      />
                    </div>

                    {stat2 && (
                      <div>
                        <div className="text-2xl font-bold text-purple-500 mb-2 text-center">
                          {stat2.value}
                        </div>
                        <ProgressBar
                          value={stat2.value}
                          max={maxValue}
                          color="purple"
                          size="sm"
                        />
                      </div>
                    )}
                  </div>

                  {stat2 && (
                    <div className="text-center mt-2 text-xs text-gray-500">
                      {stat.value > stat2.value ? (
                        <span className="text-[#00d4ff]">
                          {player1.name} +{(stat.value - stat2.value).toFixed(1)}
                        </span>
                      ) : stat.value < stat2.value ? (
                        <span className="text-purple-500">
                          {player2.name} +{(stat2.value - stat.value).toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-500">Tied</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
