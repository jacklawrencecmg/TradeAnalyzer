import { Database, TrendingUp, Clock } from 'lucide-react';

interface DataAttributionProps {
  lastUpdated?: string;
  compact?: boolean;
}

export function DataAttribution({ lastUpdated, compact = false }: DataAttributionProps) {
  const updateText = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'today';

  if (compact) {
    return (
      <div className="text-xs text-fdp-text-3 text-center py-2">
        Data via <span className="font-semibold text-fdp-accent-1">FDP Dynasty Values</span>
      </div>
    );
  }

  return (
    <div className="bg-fdp-surface-1 rounded-lg p-6 border border-fdp-border-1">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-lg flex items-center justify-center flex-shrink-0">
          <Database className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-2">Data Source</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-fdp-text-2">
              <TrendingUp className="w-4 h-4 text-fdp-accent-1" />
              <span>
                <span className="font-semibold text-fdp-accent-1">FDP Dynasty Value Model</span>
                {' — '}
                Proprietary valuation system combining market consensus, production metrics,
                age curves, and situational factors
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-fdp-text-2">
              <Clock className="w-4 h-4 text-fdp-accent-1" />
              <span>
                <span className="font-semibold">Updated:</span> {updateText}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-fdp-border-1">
            <p className="text-xs text-fdp-text-3 leading-relaxed">
              Dynasty values are calculated using our advanced model that processes thousands of
              dynasty trades, expert rankings, and player performance data. Values reflect
              long-term dynasty worth across standard scoring formats. All data is updated
              daily and verified for accuracy.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-fdp-border-1">
        <div className="flex items-center justify-between text-xs text-fdp-text-3">
          <div>
            <span className="font-semibold">Publisher:</span> Fantasy Draft Pros
          </div>
          <div>
            <span className="font-semibold">License:</span> Display with attribution
          </div>
          <div>
            <span className="font-semibold">Methodology:</span>{' '}
            <a
              href="/help"
              className="text-fdp-accent-1 hover:text-fdp-accent-2 underline"
            >
              View Details
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmbedAttribution() {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-sm text-fdp-text-3">
      <span>Powered by</span>
      <a
        href="https://www.fantasydraftpros.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-fdp-accent-1 hover:text-fdp-accent-2 transition-colors"
      >
        Fantasy Draft Pros Dynasty Values
      </a>
    </div>
  );
}

export function InlineAttribution({ className = '' }: { className?: string }) {
  return (
    <div className={`text-xs text-fdp-text-3 ${className}`}>
      Data via{' '}
      <a
        href="https://www.fantasydraftpros.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-fdp-accent-1 hover:text-fdp-accent-2"
      >
        FDP Dynasty Values
      </a>
    </div>
  );
}
