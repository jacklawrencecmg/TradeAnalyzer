/**
 * Model Health Dashboard
 *
 * Admin interface for monitoring self-correcting model performance.
 *
 * Displays:
 * - Accuracy trends by position
 * - Detected biases
 * - Parameter adjustments
 * - Biggest prediction misses
 * - Learning system health
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  CheckCircle,
  Settings,
  BarChart3,
  Target,
} from 'lucide-react';

interface AccuracyTrend {
  position: string;
  format: string;
  avg_error_trend: number[];
  accuracy_score_trend: number[];
  improving: boolean;
}

interface ParameterAdjustment {
  parameter: string;
  category: string;
  current_value: number;
  default_value: number;
  total_adjustment: number;
  adjustment_count: number;
  last_adjusted_at: string | null;
}

interface SystemHealth {
  healthy: boolean;
  warnings: string[];
  stats: {
    total_parameters: number;
    auto_tune_enabled: number;
    parameters_adjusted: number;
    avg_adjustment: number;
    recent_accuracy: number | null;
  };
}

export function ModelHealthDashboard() {
  const [trends, setTrends] = useState<AccuracyTrend[]>([]);
  const [parameters, setParameters] = useState<ParameterAdjustment[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    try {
      // TODO: Implement API calls
      // const trendsData = await fetch('/api/admin/accuracy-trends').then(r => r.json());
      // const paramsData = await fetch('/api/admin/parameter-summary').then(r => r.json());
      // const healthData = await fetch('/api/admin/model-health').then(r => r.json());

      // setTrends(trendsData);
      // setParameters(paramsData);
      // setHealth(healthData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading model health data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Model Health Dashboard</h1>
          <p className="text-gray-600 mt-1">Self-correcting model performance and learning</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* System Health Overview */}
      <SystemHealthCard health={health} />

      {/* Accuracy Trends Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trends.map((trend) => (
          <AccuracyTrendCard key={`${trend.position}-${trend.format}`} trend={trend} />
        ))}
      </div>

      {/* Parameter Adjustments */}
      <ParameterAdjustmentsCard parameters={parameters} />

      {/* Recent Learning Activity */}
      <RecentLearningCard />
    </div>
  );
}

/**
 * System Health Overview Card
 */
function SystemHealthCard({ health }: { health: SystemHealth | null }) {
  if (!health) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {health.healthy ? (
            <CheckCircle className="w-8 h-8 text-green-600" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          )}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
            <p className={`text-sm ${health.healthy ? 'text-green-600' : 'text-orange-600'}`}>
              {health.healthy ? 'All systems operational' : 'Warnings detected'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {health.stats.total_parameters}
          </div>
          <div className="text-xs text-gray-600 mt-1">Total Parameters</div>
        </div>

        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-900">
            {health.stats.auto_tune_enabled}
          </div>
          <div className="text-xs text-green-700 mt-1">Auto-Tune Enabled</div>
        </div>

        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-900">
            {health.stats.parameters_adjusted}
          </div>
          <div className="text-xs text-blue-700 mt-1">Adjusted</div>
        </div>

        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-900">
            ±{(health.stats.avg_adjustment * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-purple-700 mt-1">Avg Adjustment</div>
        </div>

        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-900">
            {health.stats.recent_accuracy
              ? `${(health.stats.recent_accuracy * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
          <div className="text-xs text-orange-700 mt-1">Recent Accuracy</div>
        </div>
      </div>

      {/* Warnings */}
      {health.warnings.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Warnings</h3>
          <ul className="space-y-1">
            {health.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-orange-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Accuracy Trend Card
 */
function AccuracyTrendCard({ trend }: { trend: AccuracyTrend }) {
  const latestAccuracy = trend.accuracy_score_trend[trend.accuracy_score_trend.length - 1] || 0;
  const latestError = trend.avg_error_trend[trend.avg_error_trend.length - 1] || 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {trend.position} ({trend.format})
          </h3>
          <p className="text-sm text-gray-600 mt-1">Last 4 weeks performance</p>
        </div>
        {trend.improving ? (
          <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Improving</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium">Declining</span>
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {(latestAccuracy * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-600">Accuracy Score</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">±{latestError.toFixed(1)}</div>
          <div className="text-xs text-gray-600">Avg Error (ranks)</div>
        </div>
      </div>

      {/* Mini Trend Chart */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700">Error Trend</div>
        <div className="flex items-end gap-1 h-16">
          {trend.avg_error_trend.map((error, index) => {
            const maxError = Math.max(...trend.avg_error_trend);
            const height = (error / maxError) * 100;

            return (
              <div
                key={index}
                className="flex-1 bg-blue-600 rounded-t"
                style={{ height: `${height}%` }}
                title={`Week ${index + 1}: ${error.toFixed(1)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Parameter Adjustments Card
 */
function ParameterAdjustmentsCard({ parameters }: { parameters: ParameterAdjustment[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(parameters.map((p) => p.category))];

  const filteredParams =
    selectedCategory === 'all'
      ? parameters
      : parameters.filter((p) => p.category === selectedCategory);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">Parameter Adjustments</h2>
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">Parameter</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">Current</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">Default</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">Adjustment</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">Times Adjusted</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">Last Adjusted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredParams.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No parameters found
                </td>
              </tr>
            ) : (
              filteredParams.map((param) => (
                <tr key={param.parameter} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {param.parameter.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-gray-500">{param.category}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">
                    {param.current_value.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {param.default_value.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        param.total_adjustment > 0.01
                          ? 'bg-green-50 text-green-700'
                          : param.total_adjustment < -0.01
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {param.total_adjustment > 0 && '+'}
                      {(param.total_adjustment * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {param.adjustment_count}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 text-xs">
                    {param.last_adjusted_at
                      ? new Date(param.last_adjusted_at).toLocaleDateString()
                      : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Recent Learning Activity Card
 */
function RecentLearningCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-6 h-6 text-gray-700" />
        <h2 className="text-xl font-semibold text-gray-900">Recent Learning Activity</h2>
      </div>

      <div className="space-y-3">
        {/* Placeholder for recent activity */}
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No recent learning activity</p>
          <p className="text-xs mt-1">
            Activity will appear after weekly accuracy calculations
          </p>
        </div>
      </div>
    </div>
  );
}

export default ModelHealthDashboard;
