interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses = {
  blue: 'from-[#00d4ff] to-[#0099cc]',
  green: 'from-emerald-500 to-emerald-600',
  yellow: 'from-yellow-500 to-yellow-600',
  red: 'from-red-500 to-red-600',
  purple: 'from-purple-500 to-purple-600',
};

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-3.5',
};

export function ProgressBar({
  value,
  max,
  label,
  showPercentage = false,
  color = 'blue',
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-semibold text-white">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      <div className={`w-full bg-gray-800 rounded-full overflow-hidden ${sizeClasses[size]} relative`}>
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full transition-all duration-500 ease-out relative overflow-hidden`}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-white opacity-20 animate-pulse-subtle"></div>
        </div>
      </div>
    </div>
  );
}

interface RankingBarProps {
  rank: number;
  totalPlayers: number;
  playerName: string;
}

export function RankingBar({ rank, totalPlayers, playerName }: RankingBarProps) {
  const percentile = ((totalPlayers - rank) / totalPlayers) * 100;

  let color: 'green' | 'blue' | 'yellow' | 'red' = 'blue';
  if (percentile >= 90) color = 'green';
  else if (percentile >= 70) color = 'blue';
  else if (percentile >= 50) color = 'yellow';
  else color = 'red';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">{playerName}</span>
        <span className="text-xs text-gray-500">
          Rank {rank} of {totalPlayers}
        </span>
      </div>
      <ProgressBar
        value={percentile}
        max={100}
        color={color}
        size="sm"
      />
    </div>
  );
}
