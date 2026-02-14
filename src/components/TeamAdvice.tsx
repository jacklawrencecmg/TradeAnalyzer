import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Target, AlertCircle, CheckCircle, LightbulbIcon, RefreshCw, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TeamAdviceProps {
  leagueId?: string;
  sleeperLeagueId?: string;
  rosterId?: number;
}

interface TeamStrategy {
  window: 'contend' | 'retool' | 'rebuild';
  confidence: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  metrics: {
    starter_strength: number;
    future_value: number;
    aging_risk: number;
    depth_score: number;
    positional_scores: Record<string, number>;
    league_percentile: number;
  };
  calculated_at?: string;
}

export default function TeamAdvice({ leagueId, sleeperLeagueId, rosterId }: TeamAdviceProps) {
  const [strategy, setStrategy] = useState<TeamStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategy();
  }, [leagueId, sleeperLeagueId, rosterId]);

  const fetchStrategy = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const body: any = {
        force_refresh: forceRefresh,
      };

      if (leagueId) {
        body.league_id = leagueId;
      } else if (sleeperLeagueId) {
        body.sleeper_league_id = sleeperLeagueId;
      } else {
        throw new Error('Either leagueId or sleeperLeagueId is required');
      }

      if (rosterId) {
        body.roster_id = rosterId;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-team-strategy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate strategy');
      }

      setStrategy(data.strategies || data.strategy);
    } catch (err) {
      console.error('Error fetching team strategy:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team advice');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStrategy(true);
  };

  const getWindowConfig = (window: 'contend' | 'retool' | 'rebuild') => {
    switch (window) {
      case 'contend':
        return {
          label: 'CONTENDER',
          color: 'green',
          bgGradient: 'from-green-500 to-emerald-600',
          bgLight: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          icon: TrendingUp,
          description: 'Your team is built to win now. Maximize this championship window.',
        };
      case 'retool':
        return {
          label: 'RETOOL',
          color: 'yellow',
          bgGradient: 'from-yellow-500 to-orange-500',
          bgLight: 'bg-yellow-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200',
          icon: Minus,
          description: 'Balance present and future. Strategic moves can push you into contention.',
        };
      case 'rebuild':
        return {
          label: 'REBUILD',
          color: 'red',
          bgGradient: 'from-red-500 to-rose-600',
          bgLight: 'bg-red-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          icon: TrendingDown,
          description: 'Focus on the future. Acquire picks and young talent for sustained success.',
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Analyzing your team strategy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3 text-red-700 mb-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-semibold">Unable to Load Team Advice</h3>
        </div>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No strategy data available</p>
      </div>
    );
  }

  const config = getWindowConfig(strategy.window);
  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${config.bgGradient} rounded-lg shadow-lg p-6 text-white`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">{config.label}</h2>
              <p className="text-white/90 text-sm mt-1">{config.description}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>

        {/* Confidence Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Confidence</span>
            <span className="font-bold">{strategy.confidence}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${strategy.confidence}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm font-medium">League Rank</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {strategy.metrics.league_percentile}th
          </div>
          <div className="text-xs text-gray-500 mt-1">percentile</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">Starter Value</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {strategy.metrics.starter_strength.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">FDP value</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">Future Value</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {strategy.metrics.future_value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">youth (≤24)</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-1">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Aging Risk</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {strategy.metrics.aging_risk.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">veterans</div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">Strengths</h3>
          </div>
          {strategy.strengths.length > 0 ? (
            <ul className="space-y-2">
              {strategy.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-2 text-gray-700">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No significant strengths identified</p>
          )}
        </div>

        {/* Weaknesses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Weaknesses</h3>
          </div>
          {strategy.weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {strategy.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start gap-2 text-gray-700">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No critical weaknesses identified</p>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <LightbulbIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-900">Recommended Actions</h3>
        </div>
        <div className="space-y-3">
          {strategy.recommendations.map((rec, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                {index + 1}
              </div>
              <p className="text-gray-700 flex-1">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Positional Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Positional Rankings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(strategy.metrics.positional_scores)
            .filter(([_, score]) => score > 0)
            .sort(([_, a], [__, b]) => b - a)
            .map(([position, score]) => {
              const percentile = Math.round(score);
              const isStrength = percentile >= 70;
              const isWeakness = percentile <= 35;
              const barColor = isStrength ? 'bg-green-500' : isWeakness ? 'bg-red-500' : 'bg-blue-500';
              const textColor = isStrength ? 'text-green-700' : isWeakness ? 'text-red-700' : 'text-gray-700';

              return (
                <div key={position} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${textColor}`}>{position}</span>
                    <span className={`text-sm font-medium ${textColor}`}>{percentile}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${barColor} rounded-full h-2 transition-all duration-500`}
                      style={{ width: `${percentile}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Last Updated */}
      {strategy.calculated_at && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {new Date(strategy.calculated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
