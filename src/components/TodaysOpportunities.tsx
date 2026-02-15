/**
 * Today's Opportunities Card
 *
 * Homepage widget displaying actionable player advice:
 * - Buy Low
 * - Sell High
 * - Breakouts
 * - Waiver Targets
 * - Stashes (dynasty)
 * - Avoid/Traps
 *
 * Each card shows confidence and reasoning.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Zap,
  UserPlus,
  Star,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface PlayerAdvice {
  playerId: string;
  playerName: string;
  position: string;
  adviceType: 'buy_low' | 'sell_high' | 'breakout' | 'waiver' | 'stash' | 'avoid';
  confidence: number;
  reason: string;
  valueDelta: number;
  supportingFactors?: string[];
}

interface TodaysOpportunitiesProps {
  format?: 'dynasty' | 'redraft';
  leagueProfileId?: string | null;
  limit?: number;
}

export function TodaysOpportunities({
  format = 'dynasty',
  leagueProfileId = null,
  limit = 6,
}: TodaysOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState<PlayerAdvice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadOpportunities();
  }, [format, leagueProfileId]);

  async function loadOpportunities() {
    setLoading(true);

    try {
      // TODO: Implement API call
      // const url = `/api/advice?format=${format}${leagueProfileId ? `&profile=${leagueProfileId}` : ''}&limit=${limit}`;
      // const response = await fetch(url);
      // const data = await response.json();
      // setOpportunities(data.opportunities);
      // setLastUpdated(new Date(data.generatedAt));

      // Mock data for now
      const mockData: PlayerAdvice[] = [
        {
          playerId: '1',
          playerName: 'Garrett Wilson',
          position: 'WR',
          adviceType: 'buy_low',
          confidence: 85,
          reason: 'Market hasn\'t adjusted to increased target share',
          valueDelta: 820,
        },
        {
          playerId: '2',
          playerName: 'Raheem Mostert',
          position: 'RB',
          adviceType: 'sell_high',
          confidence: 78,
          reason: 'TD rate unsustainably high',
          valueDelta: -950,
        },
        {
          playerId: '3',
          playerName: 'Jordan Addison',
          position: 'WR',
          adviceType: 'breakout',
          confidence: 82,
          reason: 'Classic year 2-3 WR breakout pattern',
          valueDelta: 450,
        },
      ];

      setOpportunities(mockData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          <h2 className="text-xl font-bold text-gray-900">Loading Opportunities...</h2>
        </div>
      </div>
    );
  }

  // Group by advice type
  const groupedOpportunities = opportunities.reduce((acc, opp) => {
    if (!acc[opp.adviceType]) {
      acc[opp.adviceType] = [];
    }
    acc[opp.adviceType].push(opp);
    return acc;
  }, {} as Record<string, PlayerAdvice[]>);

  // Get filtered opportunities
  const displayOpportunities = selectedType
    ? groupedOpportunities[selectedType] || []
    : opportunities;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Today's Opportunities</h2>
            <p className="text-sm text-gray-600 mt-1">
              Actionable player advice based on value vs market
            </p>
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200">
        <FilterTab
          label="All"
          count={opportunities.length}
          active={selectedType === null}
          onClick={() => setSelectedType(null)}
        />
        {Object.entries(groupedOpportunities).map(([type, items]) => (
          <FilterTab
            key={type}
            label={getAdviceTypeLabel(type)}
            count={items.length}
            active={selectedType === type}
            onClick={() => setSelectedType(type)}
            icon={getAdviceTypeIcon(type)}
          />
        ))}
      </div>

      {/* Opportunities list */}
      <div className="divide-y divide-gray-200">
        {displayOpportunities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No opportunities available</p>
            <p className="text-xs mt-1">Check back after the daily update</p>
          </div>
        ) : (
          displayOpportunities.map((opp) => (
            <OpportunityCard key={`${opp.playerId}-${opp.adviceType}`} opportunity={opp} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 text-center">
        <button
          onClick={loadOpportunities}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
    </div>
  );
}

/**
 * Filter tab component
 */
function FilterTab({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'text-blue-600 border-b-2 border-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{count}</span>
    </button>
  );
}

/**
 * Individual opportunity card
 */
function OpportunityCard({ opportunity }: { opportunity: PlayerAdvice }) {
  const [expanded, setExpanded] = useState(false);

  const config = getAdviceConfig(opportunity.adviceType);

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`${config.bgColor} p-2 rounded-lg flex-shrink-0`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${config.textColor} uppercase tracking-wide`}>
                  {config.label}
                </span>
                <ConfidenceBadge confidence={opportunity.confidence} />
              </div>
              <h3 className="font-bold text-gray-900 mt-1">{opportunity.playerName}</h3>
              <p className="text-sm text-gray-600">{opportunity.position}</p>
            </div>

            {opportunity.valueDelta !== 0 && (
              <div className="text-right flex-shrink-0">
                <div
                  className={`text-sm font-semibold ${
                    opportunity.valueDelta > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {opportunity.valueDelta > 0 ? '+' : ''}
                  {opportunity.valueDelta}
                </div>
                <div className="text-xs text-gray-500">delta</div>
              </div>
            )}
          </div>

          {/* Reason */}
          <p className="text-sm text-gray-700 leading-relaxed mt-2">{opportunity.reason}</p>

          {/* Supporting factors (collapsible) */}
          {opportunity.supportingFactors && opportunity.supportingFactors.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {expanded ? 'Hide' : 'Show'} details
              </button>

              {expanded && (
                <ul className="mt-2 space-y-1">
                  {opportunity.supportingFactors.map((factor, idx) => (
                    <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Confidence badge
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = 'bg-gray-100 text-gray-700';

  if (confidence >= 80) {
    color = 'bg-green-100 text-green-700';
  } else if (confidence >= 65) {
    color = 'bg-blue-100 text-blue-700';
  } else if (confidence >= 50) {
    color = 'bg-yellow-100 text-yellow-700';
  }

  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${color}`}>{confidence}%</span>
  );
}

/**
 * Get advice type configuration
 */
function getAdviceConfig(adviceType: string) {
  const configs: Record<
    string,
    { label: string; icon: React.ReactNode; bgColor: string; textColor: string }
  > = {
    buy_low: {
      label: 'Buy Low',
      icon: <TrendingDown className="w-5 h-5 text-green-600" />,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    sell_high: {
      label: 'Sell High',
      icon: <TrendingUp className="w-5 h-5 text-red-600" />,
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
    },
    breakout: {
      label: 'Breakout',
      icon: <Zap className="w-5 h-5 text-yellow-600" />,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
    },
    waiver: {
      label: 'Waiver',
      icon: <UserPlus className="w-5 h-5 text-blue-600" />,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    stash: {
      label: 'Stash',
      icon: <Star className="w-5 h-5 text-purple-600" />,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    avoid: {
      label: 'Avoid',
      icon: <AlertTriangle className="w-5 h-5 text-orange-600" />,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  };

  return (
    configs[adviceType] || {
      label: adviceType,
      icon: <AlertTriangle className="w-5 h-5 text-gray-600" />,
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-600',
    }
  );
}

function getAdviceTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    buy_low: 'Buy Low',
    sell_high: 'Sell High',
    breakout: 'Breakout',
    waiver: 'Waiver',
    stash: 'Stash',
    avoid: 'Avoid',
  };
  return labels[type] || type;
}

function getAdviceTypeIcon(type: string): React.ReactNode {
  const config = getAdviceConfig(type);
  return config.icon;
}

export default TodaysOpportunities;
