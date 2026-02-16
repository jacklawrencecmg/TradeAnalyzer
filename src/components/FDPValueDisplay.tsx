/**
 * FDP Value Display Component
 *
 * Standardized component for displaying FDP values.
 * This is the ONLY legal way to render player values in the UI.
 *
 * DO NOT render fdp.value directly anywhere else.
 * This component ensures proper formatting and immutability.
 */

import type { FDPValueBundle } from '../lib/fdp/types';
import {
  formatFDPValue,
  formatFDPTier,
  formatFDPRank,
  getFDPValueAge,
  isFDPValueStale,
} from '../lib/fdp/types';

interface FDPValueDisplayProps {
  fdp: FDPValueBundle;
  style?: 'compact' | 'full' | 'minimal';
  showTier?: boolean;
  showRank?: boolean;
  showAge?: boolean;
  className?: string;
}

export function FDPValueDisplay({
  fdp,
  style = 'compact',
  showTier = false,
  showRank = false,
  showAge = false,
  className = '',
}: FDPValueDisplayProps) {
  const isStale = isFDPValueStale(fdp);

  if (style === 'minimal') {
    return (
      <span className={`font-semibold ${isStale ? 'text-orange-600' : 'text-gray-900'} ${className}`}>
        {formatFDPValue(fdp.value)}
      </span>
    );
  }

  if (style === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className={`text-lg font-bold ${isStale ? 'text-orange-600' : 'text-gray-900'}`}>
          {formatFDPValue(fdp.value)}
        </span>
        {showTier && (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            {formatFDPTier(fdp.tier)}
          </span>
        )}
        {showRank && (
          <span className="text-xs text-gray-500">
            {formatFDPRank(fdp.overall_rank)}
          </span>
        )}
        {isStale && (
          <span className="text-xs text-orange-600" title="Value is stale">
            ⚠️
          </span>
        )}
      </div>
    );
  }

  // Full style
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold ${isStale ? 'text-orange-600' : 'text-gray-900'}`}>
          {formatFDPValue(fdp.value)}
        </span>
        <span className="text-sm px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
          {formatFDPTier(fdp.tier)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span>{formatFDPRank(fdp.overall_rank)}</span>
        <span className="text-gray-400">•</span>
        <span>{formatFDPRank(fdp.pos_rank, true)} {fdp.position}</span>
        {showAge && (
          <>
            <span className="text-gray-400">•</span>
            <span className={isStale ? 'text-orange-600' : ''}>
              {getFDPValueAge(fdp)}
            </span>
          </>
        )}
      </div>

      {isStale && (
        <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
          ⚠️ This value is stale and should be refreshed
        </div>
      )}
    </div>
  );
}

/**
 * Compact value display for tables/lists
 */
export function FDPValueCompact({ fdp, className = '' }: { fdp: FDPValueBundle; className?: string }) {
  return <FDPValueDisplay fdp={fdp} style="compact" className={className} />;
}

/**
 * Minimal value display (just the number)
 */
export function FDPValueMinimal({ fdp, className = '' }: { fdp: FDPValueBundle; className?: string }) {
  return <FDPValueDisplay fdp={fdp} style="minimal" className={className} />;
}

/**
 * Full value display with all details
 */
export function FDPValueFull({ fdp, className = '' }: { fdp: FDPValueBundle; className?: string }) {
  return <FDPValueDisplay fdp={fdp} style="full" showAge className={className} />;
}
