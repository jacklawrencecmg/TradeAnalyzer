/**
 * Scarcity Tooltip Component
 *
 * Displays explanation of scarcity adjustments on player pages.
 * Shows users why a player's value is what it is in their specific league.
 *
 * Example:
 *   "Value adjusted for positional scarcity (replacement level: WR42 in this league)"
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface ScarcityTooltipProps {
  position: string;
  positionRank: number;
  replacementRank: number;
  vor?: number;
  profileName?: string;
  className?: string;
}

export function ScarcityTooltip({
  position,
  positionRank,
  replacementRank,
  vor,
  profileName,
  className = '',
}: ScarcityTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Calculate distance from replacement
  const distance = replacementRank - positionRank;

  // Determine tier
  const tier = distance > 20 ? 'elite' :
                distance > 10 ? 'starter' :
                distance > 0 ? 'borderline' :
                'bench';

  const tierColors = {
    elite: 'text-green-600',
    starter: 'text-blue-600',
    borderline: 'text-yellow-600',
    bench: 'text-gray-600',
  };

  const tierLabels = {
    elite: 'Elite Starter',
    starter: 'Solid Starter',
    borderline: 'Borderline Starter',
    bench: 'Bench Player',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <Info className="w-4 h-4" />
        <span className="text-xs">Scarcity adjusted</span>
      </button>

      {isVisible && (
        <div className="absolute z-50 w-80 p-4 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 left-0">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">
                  Scarcity Adjustment
                </h4>
                {profileName && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {profileName}
                  </p>
                )}
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${tierColors[tier]} bg-opacity-10`}>
                {tierLabels[tier]}
              </span>
            </div>

            {/* Explanation */}
            <div className="text-sm text-gray-700">
              <p>
                Value adjusted for positional scarcity in this league format.
                Replacement level: <strong>{position}{replacementRank}</strong>
              </p>
            </div>

            {/* Distance from replacement */}
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Position Rank:</span>
                <span className="font-medium">{position}{positionRank}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Replacement:</span>
                <span className="font-medium">{position}{replacementRank}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600">Distance:</span>
                <span className={`font-semibold ${distance > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {distance > 0 ? '+' : ''}{distance} spots
                </span>
              </div>
            </div>

            {/* VOR if available */}
            {vor !== undefined && (
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Value Over Replacement:</span>
                  <span className={`font-semibold ${vor > 0 ? 'text-green-600' : vor < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {vor > 0 ? '+' : ''}{vor}
                  </span>
                </div>
              </div>
            )}

            {/* Explanation text */}
            <div className="pt-3 border-t border-gray-200 text-xs text-gray-600">
              {distance > 0 ? (
                <p>
                  This player is <strong>{distance}</strong> spots above the typical
                  replacement level player at {position} in your league, making them
                  a valuable asset for your starting lineup.
                </p>
              ) : distance < 0 ? (
                <p>
                  This player ranks below the typical replacement level at {position} in
                  your league, indicating limited lineup impact and bench depth value.
                </p>
              ) : (
                <p>
                  This player is at the replacement level for {position} in your league,
                  representing a borderline starter or high-end bench player.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Scarcity Badge
 *
 * Minimal badge showing just the tier without tooltip
 */
export function ScarcityBadge({
  positionRank,
  replacementRank,
  className = '',
}: {
  positionRank: number;
  replacementRank: number;
  className?: string;
}) {
  const distance = replacementRank - positionRank;

  if (distance <= 0) {
    return null; // Don't show badge for below-replacement players
  }

  const tier = distance > 20 ? 'elite' :
                distance > 10 ? 'starter' :
                'borderline';

  const badgeStyles = {
    elite: 'bg-green-100 text-green-800 border-green-200',
    starter: 'bg-blue-100 text-blue-800 border-blue-200',
    borderline: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };

  const labels = {
    elite: 'Elite',
    starter: 'Starter',
    borderline: 'Flex',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badgeStyles[tier]} ${className}`}>
      {labels[tier]}
    </span>
  );
}

/**
 * Detailed Scarcity Panel
 *
 * Full breakdown panel for player detail pages
 */
export function ScarcityPanel({
  position,
  positionRank,
  replacementRank,
  rawValue,
  finalValue,
  vor,
  elasticityAdjustment,
  profileName,
}: {
  position: string;
  positionRank: number;
  replacementRank: number;
  rawValue?: number;
  finalValue?: number;
  vor?: number;
  elasticityAdjustment?: number;
  profileName?: string;
}) {
  const distance = replacementRank - positionRank;
  const hasDetailedData = rawValue !== undefined && finalValue !== undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Scarcity Analysis
        </h3>
      </div>

      {profileName && (
        <p className="text-sm text-gray-600 mb-4">
          For <strong>{profileName}</strong> format
        </p>
      )}

      {/* Position info */}
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">Position Rank</span>
          <span className="font-semibold text-gray-900">{position}{positionRank}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">Replacement Level</span>
          <span className="font-semibold text-gray-900">{position}{replacementRank}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">Distance from Replacement</span>
          <span className={`font-bold ${distance > 0 ? 'text-green-600' : distance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {distance > 0 ? '+' : ''}{distance} spots
          </span>
        </div>

        {/* Value breakdown if available */}
        {hasDetailedData && (
          <>
            <div className="pt-3 mt-3 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Value Breakdown
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Base Value</span>
                  <span className="font-medium">{rawValue.toLocaleString()}</span>
                </div>

                {vor !== undefined && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">VOR Adjustment</span>
                    <span className={`font-medium ${vor > 0 ? 'text-green-600' : vor < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {vor > 0 ? '+' : ''}{vor.toLocaleString()}
                    </span>
                  </div>
                )}

                {elasticityAdjustment !== undefined && elasticityAdjustment !== 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Elasticity Adjustment</span>
                    <span className={`font-medium ${elasticityAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {elasticityAdjustment > 0 ? '+' : ''}{elasticityAdjustment.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-gray-100">
                  <span className="text-gray-900 font-semibold">Final Value</span>
                  <span className="font-bold text-lg">{finalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Explanation */}
        <div className="pt-3 mt-3 border-t border-gray-200">
          <p className="text-sm text-gray-700">
            {distance > 0 ? (
              <>
                <strong className="text-green-700">Above Replacement:</strong> This player
                ranks {distance} spots above the typical replacement level at {position},
                indicating strong lineup impact and value in your league format.
              </>
            ) : distance < 0 ? (
              <>
                <strong className="text-red-700">Below Replacement:</strong> This player
                ranks {Math.abs(distance)} spots below the typical replacement level,
                suggesting limited lineup impact and primarily bench depth value.
              </>
            ) : (
              <>
                <strong className="text-yellow-700">At Replacement:</strong> This player
                is at the borderline between starter and bench in your league format.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ScarcityTooltip;
