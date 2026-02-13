import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PlayoffMeterProps {
  probability: number;
  teamName: string;
  trend?: number;
  rank?: number;
  showDetails?: boolean;
}

export function PlayoffMeter({
  probability,
  teamName,
  trend,
  rank,
  showDetails = true
}: PlayoffMeterProps) {
  const clampedProb = Math.min(100, Math.max(0, probability));

  let color = 'from-red-500 to-red-600';
  let bgColor = 'bg-red-500/10';
  let textColor = 'text-red-500';

  if (clampedProb >= 80) {
    color = 'from-emerald-500 to-emerald-600';
    bgColor = 'bg-emerald-500/10';
    textColor = 'text-emerald-500';
  } else if (clampedProb >= 60) {
    color = 'from-blue-500 to-blue-600';
    bgColor = 'bg-blue-500/10';
    textColor = 'text-blue-500';
  } else if (clampedProb >= 40) {
    color = 'from-yellow-500 to-yellow-600';
    bgColor = 'bg-yellow-500/10';
    textColor = 'text-yellow-500';
  } else if (clampedProb >= 20) {
    color = 'from-orange-500 to-orange-600';
    bgColor = 'bg-orange-500/10';
    textColor = 'text-orange-500';
  }

  const getTrendIcon = () => {
    if (trend === undefined) return null;

    if (trend > 0) {
      return (
        <div className="flex items-center gap-1 text-emerald-500">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-semibold">+{trend.toFixed(1)}%</span>
        </div>
      );
    } else if (trend < 0) {
      return (
        <div className="flex items-center gap-1 text-red-500">
          <TrendingDown className="w-4 h-4" />
          <span className="text-xs font-semibold">{trend.toFixed(1)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Minus className="w-4 h-4" />
          <span className="text-xs font-semibold">0%</span>
        </div>
      );
    }
  };

  return (
    <div className={`rounded-xl p-4 border border-gray-700 ${bgColor} backdrop-blur-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="font-semibold text-white text-sm mb-1">{teamName}</div>
          {rank && (
            <div className="text-xs text-gray-400">Rank #{rank}</div>
          )}
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${textColor}`}>
            {clampedProb.toFixed(0)}%
          </div>
          {getTrendIcon()}
        </div>
      </div>

      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full bg-gradient-to-r ${color} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${clampedProb}%` }}
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse-subtle"></div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-gray-500">Playoff Probability</span>
          <span className={`font-semibold ${textColor}`}>
            {clampedProb >= 80 ? 'Very Likely' :
             clampedProb >= 60 ? 'Likely' :
             clampedProb >= 40 ? 'Possible' :
             clampedProb >= 20 ? 'Unlikely' :
             'Very Unlikely'}
          </span>
        </div>
      )}
    </div>
  );
}

interface PlayoffOddsGridProps {
  teams: {
    name: string;
    probability: number;
    trend?: number;
    rank: number;
  }[];
}

export function PlayoffOddsGrid({ teams }: PlayoffOddsGridProps) {
  const sortedTeams = [...teams].sort((a, b) => b.probability - a.probability);

  return (
    <div className="space-y-3">
      {sortedTeams.map((team) => (
        <PlayoffMeter
          key={team.name}
          teamName={team.name}
          probability={team.probability}
          trend={team.trend}
          rank={team.rank}
          showDetails={true}
        />
      ))}
    </div>
  );
}
