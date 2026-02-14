import { Shield, X } from 'lucide-react';
import { useSafeMode } from '../hooks/useSafeMode';

interface SafeModeBannerProps {
  onDismiss?: () => void;
}

export default function SafeModeBanner({ onDismiss }: SafeModeBannerProps) {
  const { safeMode, loading } = useSafeMode();

  if (loading || !safeMode.enabled) {
    return null;
  }

  function formatTimeSince(since: string | null): string {
    if (!since) return '';

    const date = new Date(since);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">System Safe Mode Active</p>
              <p className="text-sm opacity-90">
                {safeMode.reason || 'Critical system issues detected'}
                {safeMode.since && ` • Active since ${formatTimeSince(safeMode.since)}`}
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-red-700 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
