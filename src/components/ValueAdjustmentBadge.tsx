import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { formatAdjustment, getTrendColorClass } from '../lib/adjustments/getEffectiveValue';

interface ValueAdjustmentBadgeProps {
  adjustment: number;
  adjustments?: Array<{
    delta: number;
    reason: string;
    source: string;
    confidence: number;
    expires_at: string;
  }>;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ValueAdjustmentBadge({
  adjustment,
  adjustments = [],
  showTooltip = true,
  size = 'md',
}: ValueAdjustmentBadgeProps) {
  if (adjustment === 0) return null;

  const isPositive = adjustment > 0;
  const trend = isPositive ? 'up' : 'down';
  const colorClass = getTrendColorClass(trend);

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="relative inline-block group">
      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1 rounded font-medium ${sizeClasses[size]} ${
          isPositive
            ? 'bg-green-900/30 text-green-400 border border-green-500/30'
            : 'bg-red-900/30 text-red-400 border border-red-500/30'
        }`}
      >
        {isPositive ? (
          <TrendingUp className={iconSizes[size]} />
        ) : (
          <TrendingDown className={iconSizes[size]} />
        )}
        <span>{formatAdjustment(adjustment)}</span>
        {showTooltip && adjustments.length > 0 && (
          <Info className={`${iconSizes[size]} opacity-50`} />
        )}
      </span>

      {/* Tooltip */}
      {showTooltip && adjustments.length > 0 && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 w-72">
          <div className="text-xs space-y-2">
            <div className="font-bold text-white mb-2">Active Adjustments</div>
            {adjustments.map((adj, idx) => (
              <div key={idx} className="pb-2 border-b border-gray-700 last:border-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`font-medium ${adj.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAdjustment(adj.delta)}
                  </span>
                  <span className="text-gray-400 text-right capitalize">
                    {adj.source.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-gray-300">{adj.reason}</div>
                <div className="text-gray-500 mt-1">
                  Expires: {new Date(adj.expires_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-gray-500">Confidence:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-2 rounded-full ${
                          level <= adj.confidence ? 'bg-blue-400' : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {adjustments.length > 1 && (
              <div className="text-gray-400 pt-1 border-t border-gray-700">
                Total: {formatAdjustment(adjustment)} (capped at ±1500)
              </div>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 bg-gray-800 border-r border-b border-gray-700 transform rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
