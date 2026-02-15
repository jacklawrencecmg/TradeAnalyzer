/**
 * Market vs Model Transparency Card
 *
 * Shows users how model values compare to market consensus.
 * Builds trust by explaining differences transparently.
 *
 * Display:
 * - Model Value: 7,420
 * - Market Value: 7,150
 * - Final Value: 7,325
 * - Confidence: High (0.92)
 * - Explanation: "Model values 15 spots higher, 20% pull toward market"
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from 'lucide-react';

export interface MarketVsModelData {
  modelValue: number;
  marketValue: number;
  finalValue: number;
  modelRank?: number;
  marketRank?: number;
  anchorAdjustment: number;
  confidenceScore: number;
  isOutlier?: boolean;
  isBreakoutProtected?: boolean;
  explanation?: string;
}

interface MarketVsModelCardProps {
  data: MarketVsModelData;
  playerName?: string;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export function MarketVsModelCard({
  data,
  playerName,
  showDetails = false,
  compact = false,
  className = '',
}: MarketVsModelCardProps) {
  const {
    modelValue,
    marketValue,
    finalValue,
    modelRank,
    marketRank,
    anchorAdjustment,
    confidenceScore,
    isOutlier,
    isBreakoutProtected,
    explanation,
  } = data;

  const confidenceLabel = getConfidenceLabel(confidenceScore);
  const confidenceColor = getConfidenceColor(confidenceScore);

  const modelHigher = modelValue > marketValue;
  const difference = Math.abs(modelValue - marketValue);
  const diffPercent = marketValue > 0 ? ((difference / marketValue) * 100).toFixed(1) : '0';

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-sm text-gray-600">
          Confidence: <span className={`font-semibold ${confidenceColor}`}>{confidenceLabel}</span>
        </span>
        {isOutlier && (
          <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" />
            Outlier
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Value Breakdown
          </h3>
          {playerName && (
            <p className="text-xs text-gray-500 mt-0.5">{playerName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${confidenceColor}`}>
            {confidenceLabel}
          </span>
          {isOutlier && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              <AlertTriangle className="w-3 h-3" />
              Outlier
            </span>
          )}
          {isBreakoutProtected && (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              <TrendingUp className="w-3 h-3" />
              Breakout
            </span>
          )}
        </div>
      </div>

      {/* Values */}
      <div className="space-y-3">
        {/* Model Value */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Model Value
            {modelRank && <span className="text-xs ml-1">(#{modelRank})</span>}
          </span>
          <span className="font-semibold text-gray-900">
            {modelValue.toLocaleString()}
          </span>
        </div>

        {/* Market Value */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Market Value
            {marketRank && <span className="text-xs ml-1">(#{marketRank})</span>}
          </span>
          <span className="font-semibold text-gray-900">
            {marketValue.toLocaleString()}
          </span>
        </div>

        {/* Difference Indicator */}
        <div className="flex justify-between items-center py-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Difference</span>
          <div className="flex items-center gap-2">
            {modelHigher ? (
              <TrendingUp className="w-4 h-4 text-blue-600" />
            ) : modelValue === marketValue ? (
              <Minus className="w-4 h-4 text-gray-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-orange-600" />
            )}
            <span className="text-sm font-medium">
              {difference.toLocaleString()} ({diffPercent}%)
            </span>
          </div>
        </div>

        {/* Anchor Adjustment */}
        {anchorAdjustment !== 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Anchor Adjustment</span>
            <span className={`font-medium ${anchorAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {anchorAdjustment > 0 ? '+' : ''}{anchorAdjustment.toLocaleString()}
            </span>
          </div>
        )}

        {/* Final Value */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-900">Final Value</span>
          <span className="text-lg font-bold text-gray-900">
            {finalValue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Explanation */}
      {showDetails && explanation && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p>{explanation}</p>
          </div>
        </div>
      )}

      {/* Confidence Bar */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">Agreement</span>
          <span className="text-xs font-medium text-gray-700">
            {Math.round(confidenceScore * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getConfidenceBarColor(confidenceScore)}`}
            style={{ width: `${confidenceScore * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact badge showing just confidence
 */
export function ConfidenceBadge({
  confidenceScore,
  showLabel = true,
  className = '',
}: {
  confidenceScore: number;
  showLabel?: boolean;
  className?: string;
}) {
  const label = getConfidenceLabel(confidenceScore);
  const color = getConfidenceColor(confidenceScore);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color} ${className}`}>
      {showLabel && <span>{label}</span>}
      <span>({Math.round(confidenceScore * 100)}%)</span>
    </span>
  );
}

/**
 * Simple comparison indicator
 */
export function ModelVsMarketIndicator({
  modelValue,
  marketValue,
  size = 'md',
  className = '',
}: {
  modelValue: number;
  marketValue: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const modelHigher = modelValue > marketValue;
  const difference = Math.abs(modelValue - marketValue);
  const diffPercent = marketValue > 0 ? ((difference / marketValue) * 100).toFixed(1) : '0';

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  if (modelValue === marketValue) {
    return (
      <div className={`inline-flex items-center gap-1 ${textSize} text-gray-600 ${className}`}>
        <Minus className={iconSize} />
        <span>Matches market</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 ${textSize} ${className}`}>
      {modelHigher ? (
        <>
          <TrendingUp className={`${iconSize} text-blue-600`} />
          <span className="text-blue-700">
            Model +{difference.toLocaleString()} ({diffPercent}%)
          </span>
        </>
      ) : (
        <>
          <TrendingDown className={`${iconSize} text-orange-600`} />
          <span className="text-orange-700">
            Market +{difference.toLocaleString()} ({diffPercent}%)
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Detailed comparison panel for player pages
 */
export function MarketVsModelPanel({
  data,
  playerName,
  className = '',
}: {
  data: MarketVsModelData;
  playerName: string;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <MarketVsModelCard
        data={data}
        playerName={playerName}
        showDetails={true}
      />

      {/* Additional context */}
      {data.isOutlier && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-orange-900 mb-1">
                Outlier Detected
              </h4>
              <p className="text-sm text-orange-800">
                This player's model value differs significantly from market consensus
                ({Math.abs((data.modelRank || 0) - (data.marketRank || 0))} spots apart).
                The anchor adjustment is capped at 25% to prevent overcorrection.
              </p>
            </div>
          </div>
        </div>
      )}

      {data.isBreakoutProtected && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">
                Breakout Protection Active
              </h4>
              <p className="text-sm text-green-800">
                This player showed elite production recently. Anchor strength is reduced
                to avoid suppressing emerging star performance.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper functions
 */

function getConfidenceLabel(score: number): string {
  if (score >= 0.9) return 'Very High';
  if (score >= 0.75) return 'High';
  if (score >= 0.5) return 'Medium';
  if (score >= 0.25) return 'Low';
  return 'Very Low';
}

function getConfidenceColor(score: number): string {
  if (score >= 0.9) return 'text-green-600';
  if (score >= 0.75) return 'text-blue-600';
  if (score >= 0.5) return 'text-yellow-600';
  if (score >= 0.25) return 'text-orange-600';
  return 'text-red-600';
}

function getConfidenceBarColor(score: number): string {
  if (score >= 0.9) return 'bg-green-600';
  if (score >= 0.75) return 'bg-blue-600';
  if (score >= 0.5) return 'bg-yellow-500';
  if (score >= 0.25) return 'bg-orange-500';
  return 'bg-red-500';
}

export default MarketVsModelCard;
