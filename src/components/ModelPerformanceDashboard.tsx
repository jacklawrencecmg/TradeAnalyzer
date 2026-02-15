/**
 * Model Performance Dashboard
 *
 * Admin dashboard showing:
 * - Buy low hit rate
 * - Trade win rate
 * - Most helpful features
 * - Regressions after deploys
 * - Active experiments
 *
 * This is your safety net.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Activity,
  Target,
  Users,
  BarChart3,
} from 'lucide-react';
import {
  getPerformanceSummary,
  getModelPerformanceHistory,
  getRollingAveragePerformance,
  type ModelPerformance,
} from '../lib/tracking/calculateModelPerformance';
import { getActiveExperiments } from '../lib/experiments/getExperimentVariant';
import { getExperimentPerformanceSummary } from '../lib/experiments/adaptiveRollout';

export function ModelPerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getPerformanceSummary>> | null>(
    null
  );
  const [history, setHistory] = useState<ModelPerformance[]>([]);
  const [rollingAvg, setRollingAvg] = useState<Awaited<
    ReturnType<typeof getRollingAveragePerformance>
  > | null>(null);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'experiments' | 'history'>(
    'overview'
  );

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      const [summaryData, historyData, rollingAvgData, experimentsData] = await Promise.all([
        getPerformanceSummary(),
        getModelPerformanceHistory(30),
        getRollingAveragePerformance(7),
        getActiveExperiments(),
      ]);

      setSummary(summaryData);
      setHistory(historyData);
      setRollingAvg(rollingAvgData);
      setExperiments(experimentsData);
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading performance data...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Model Performance Dashboard</h1>
        <p className="text-gray-600">Real-time monitoring of model accuracy and experiments</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <TabButton
            active={selectedTab === 'overview'}
            onClick={() => setSelectedTab('overview')}
            label="Overview"
          />
          <TabButton
            active={selectedTab === 'experiments'}
            onClick={() => setSelectedTab('experiments')}
            label="Experiments"
          />
          <TabButton
            active={selectedTab === 'history'}
            onClick={() => setSelectedTab('history')}
            label="History"
          />
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Performance Alerts */}
          {summary?.regression.hasRegression && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-bold text-red-900 mb-2">
                    Performance Regression Detected
                  </h3>
                  <p className="text-red-800 mb-3">
                    The following metrics have significantly degraded:
                  </p>
                  <ul className="list-disc list-inside text-red-800">
                    {summary.regression.degradedMetrics.map((metric) => (
                      <li key={metric}>{metric}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid md:grid-cols-4 gap-6">
            <MetricCard
              title="Overall Accuracy"
              value={`${summary?.latest?.accuracyScore.toFixed(1)}%`}
              trend={summary?.trend.trend}
              icon={<Target className="w-6 h-6" />}
              color="blue"
            />

            <MetricCard
              title="Advice Success Rate"
              value={`${summary?.latest?.adviceScore.toFixed(1)}%`}
              subtitle="Buy low / Sell high"
              icon={<TrendingUp className="w-6 h-6" />}
              color="green"
            />

            <MetricCard
              title="Trade Win Rate"
              value={`${summary?.latest?.tradeScore.toFixed(1)}%`}
              subtitle="30-day evaluation"
              icon={<Activity className="w-6 h-6" />}
              color="purple"
            />

            <MetricCard
              title="Model Confidence"
              value={`${summary?.latest?.confidence}%`}
              subtitle={`${summary?.latest?.totalPredictions} predictions`}
              icon={<CheckCircle className="w-6 h-6" />}
              color="orange"
            />
          </div>

          {/* Rolling Averages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">7-Day Rolling Averages</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Accuracy</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rollingAvg?.accuracyScore.toFixed(1)}%
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Advice Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rollingAvg?.adviceScore.toFixed(1)}%
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Trade Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rollingAvg?.tradeScore.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Trend Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Performance Trend</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {summary?.trend.trend === 'improving' && (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  )}
                  {summary?.trend.trend === 'declining' && (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {summary?.trend.trend === 'improving' && 'Improving'}
                    {summary?.trend.trend === 'declining' && 'Declining'}
                    {summary?.trend.trend === 'stable' && 'Stable'}
                  </span>
                </div>
                <p className="text-gray-600">
                  Average change: {summary?.trend.averageChange.toFixed(2)}% per day
                </p>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Consistency</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${summary?.trend.consistency}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {summary?.trend.consistency.toFixed(0)}% consistent
                </p>
              </div>
            </div>
          </div>

          {/* Recent Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Last 7 Days</h2>

            <div className="space-y-2">
              {history.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-700">{formatDate(day.date)}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      Accuracy: {day.accuracyScore.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-600">
                      Advice: {day.adviceScore.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-600">
                      Trades: {day.tradeScore.toFixed(1)}%
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        day.confidence >= 70
                          ? 'bg-green-100 text-green-800'
                          : day.confidence >= 40
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {day.confidence}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Experiments Tab */}
      {selectedTab === 'experiments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Active Experiments</h2>

            {experiments.length === 0 ? (
              <p className="text-gray-600">No active experiments</p>
            ) : (
              <div className="space-y-4">
                {experiments.map((exp) => (
                  <ExperimentCard key={exp.id} experiment={exp} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {selectedTab === 'history' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Performance History (30 Days)</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-right py-2 px-4">Accuracy</th>
                  <th className="text-right py-2 px-4">Advice</th>
                  <th className="text-right py-2 px-4">Trades</th>
                  <th className="text-right py-2 px-4">Predictions</th>
                  <th className="text-right py-2 px-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {history.map((day) => (
                  <tr key={day.date} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{formatDate(day.date)}</td>
                    <td className="text-right py-2 px-4">{day.accuracyScore.toFixed(1)}%</td>
                    <td className="text-right py-2 px-4">{day.adviceScore.toFixed(1)}%</td>
                    <td className="text-right py-2 px-4">{day.tradeScore.toFixed(1)}%</td>
                    <td className="text-right py-2 px-4">{day.totalPredictions}</td>
                    <td className="text-right py-2 px-4">{day.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'improving' | 'stable' | 'declining';
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div className="flex items-center gap-1">
            {trend === 'improving' && <TrendingUp className="w-4 h-4 text-green-600" />}
            {trend === 'declining' && <TrendingDown className="w-4 h-4 text-red-600" />}
          </div>
        )}
      </div>

      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: any }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-gray-900">{experiment.key}</h3>
          <p className="text-sm text-gray-600">{experiment.description}</p>
        </div>
        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
          Active
        </span>
      </div>

      <div className="mt-4">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default ModelPerformanceDashboard;
