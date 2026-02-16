import { Clock } from 'lucide-react';
import { useState } from 'react';

interface ValueEpochBadgeProps {
  valueEpoch: number;
  updatedAt: string;
  compact?: boolean;
}

export function ValueEpochBadge({ valueEpoch, updatedAt, compact = false }: ValueEpochBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getRelativeTime = (timestamp: string): string => {
    const now = Date.now();
    const updated = new Date(timestamp).getTime();
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getEpochAge = (): { text: string; color: string } => {
    const now = Date.now();
    const ageMs = now - valueEpoch;
    const ageHours = ageMs / 3600000;

    if (ageHours < 2) {
      return { text: 'Fresh', color: 'text-green-600 bg-green-50' };
    } else if (ageHours < 12) {
      return { text: 'Recent', color: 'text-blue-600 bg-blue-50' };
    } else if (ageHours < 24) {
      return { text: 'Today', color: 'text-yellow-600 bg-yellow-50' };
    } else {
      return { text: 'Stale', color: 'text-red-600 bg-red-50' };
    }
  };

  const age = getEpochAge();
  const relativeTime = getRelativeTime(updatedAt);

  if (compact) {
    return (
      <div
        className="relative inline-flex items-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Clock className={`w-3 h-3 ${age.color.split(' ')[0]}`} />
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
            <div className="font-semibold">Values updated: {relativeTime}</div>
            <div className="text-gray-300 text-xs mt-1">
              Epoch: {new Date(valueEpoch).toLocaleString()}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Clock className="w-3 h-3" />
      <span>{relativeTime}</span>
      <span className={`px-1.5 py-0.5 rounded ${age.color} text-xs`}>
        {age.text}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg min-w-max">
          <div className="font-semibold mb-1">FDP Value Freshness</div>
          <div className="space-y-1 text-gray-300">
            <div>Updated: {relativeTime}</div>
            <div>Epoch: {new Date(valueEpoch).toLocaleString()}</div>
            <div className="pt-1 mt-1 border-t border-gray-700 text-xs">
              Values are recalculated daily
            </div>
          </div>
          <div className="absolute top-full left-4 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ValueEpochIndicator({ valueEpoch }: { valueEpoch: number }) {
  const now = Date.now();
  const ageHours = (now - valueEpoch) / 3600000;

  let color = 'bg-green-500';
  let pulseClass = '';

  if (ageHours < 2) {
    color = 'bg-green-500';
    pulseClass = 'animate-pulse';
  } else if (ageHours < 12) {
    color = 'bg-blue-500';
  } else if (ageHours < 24) {
    color = 'bg-yellow-500';
  } else {
    color = 'bg-red-500';
  }

  return (
    <div className="inline-flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${color} ${pulseClass}`}></div>
    </div>
  );
}
