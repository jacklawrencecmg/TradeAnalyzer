import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Target, Award, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConversionMetrics {
  date: string;
  total_sessions: number;
  converted_sessions: number;
  conversion_rate: number;
  low_intent_sessions: number;
  medium_intent_sessions: number;
  high_intent_sessions: number;
}

interface ExperimentPerformance {
  variant_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  click_rate: number;
  conversion_rate: number;
}

export function ConversionOptimizationDashboard() {
  const [metrics, setMetrics] = useState<ConversionMetrics[]>([]);
  const [experiments, setExperiments] = useState<ExperimentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    loadData();
  }, [selectedDays]);

  async function loadData() {
    setLoading(true);

    try {
      const { data: metricsData } = await supabase
        .rpc('get_conversion_metrics', { p_days: selectedDays });

      if (metricsData) {
        setMetrics(metricsData);
      }

      const { data: experimentsData } = await supabase
        .from('cta_experiments')
        .select('experiment_id')
        .eq('experiment_name', 'headline_test')
        .eq('is_active', true)
        .single();

      if (experimentsData) {
        const { data: perfData } = await supabase
          .rpc('get_experiment_performance', { p_experiment_id: experimentsData.experiment_id });

        if (perfData) {
          setExperiments(perfData);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectWinner(variantId: string, experimentId: string) {
    if (!confirm('Set this variant as the winner? This will end the experiment.')) {
      return;
    }

    await supabase
      .from('cta_experiments')
      .update({
        winner_variant_id: variantId,
        is_active: false,
        end_date: new Date().toISOString()
      })
      .eq('experiment_id', experimentId);

    alert('Winner selected! This variant will now be shown to all visitors.');
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 text-fdp-accent-1 animate-spin" />
      </div>
    );
  }

  const totalMetrics = metrics.reduce(
    (acc, m) => ({
      sessions: acc.sessions + m.total_sessions,
      conversions: acc.conversions + m.converted_sessions,
      lowIntent: acc.lowIntent + m.low_intent_sessions,
      mediumIntent: acc.mediumIntent + m.medium_intent_sessions,
      highIntent: acc.highIntent + m.high_intent_sessions
    }),
    { sessions: 0, conversions: 0, lowIntent: 0, mediumIntent: 0, highIntent: 0 }
  );

  const overallConversionRate = totalMetrics.sessions > 0
    ? ((totalMetrics.conversions / totalMetrics.sessions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1">
            Conversion Optimization Dashboard
          </h2>
          <p className="text-fdp-text-3 mt-1">
            Track visitor intent, A/B tests, and conversion metrics
          </p>
        </div>

        <select
          value={selectedDays}
          onChange={(e) => setSelectedDays(Number(e.target.value))}
          className="px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 rounded-lg text-fdp-text-1 focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-sm font-semibold text-fdp-text-3">
              Total Visitors
            </div>
          </div>
          <div className="text-3xl font-bold text-fdp-text-1">
            {totalMetrics.sessions.toLocaleString()}
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-sm font-semibold text-fdp-text-3">
              Conversions
            </div>
          </div>
          <div className="text-3xl font-bold text-fdp-text-1">
            {totalMetrics.conversions.toLocaleString()}
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-sm font-semibold text-fdp-text-3">
              Conversion Rate
            </div>
          </div>
          <div className="text-3xl font-bold text-fdp-text-1">
            {overallConversionRate}%
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-sm font-semibold text-fdp-text-3">
              High Intent
            </div>
          </div>
          <div className="text-3xl font-bold text-fdp-text-1">
            {totalMetrics.highIntent.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-fdp-accent-1" />
            <h3 className="text-lg font-bold text-fdp-text-1">
              Intent Distribution
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-fdp-text-2">
                  Low Intent
                </span>
                <span className="text-sm text-fdp-text-3">
                  {totalMetrics.lowIntent} ({((totalMetrics.lowIntent / totalMetrics.sessions) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-fdp-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-500"
                  style={{ width: `${(totalMetrics.lowIntent / totalMetrics.sessions) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-fdp-text-2">
                  Medium Intent
                </span>
                <span className="text-sm text-fdp-text-3">
                  {totalMetrics.mediumIntent} ({((totalMetrics.mediumIntent / totalMetrics.sessions) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-fdp-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(totalMetrics.mediumIntent / totalMetrics.sessions) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-fdp-text-2">
                  High Intent
                </span>
                <span className="text-sm text-fdp-text-3">
                  {totalMetrics.highIntent} ({((totalMetrics.highIntent / totalMetrics.sessions) * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-fdp-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                  style={{ width: `${(totalMetrics.highIntent / totalMetrics.sessions) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-fdp-accent-1" />
            <h3 className="text-lg font-bold text-fdp-text-1">
              A/B Test: Headlines
            </h3>
          </div>

          {experiments.length > 0 ? (
            <div className="space-y-4">
              {experiments.map((exp) => (
                <div
                  key={exp.variant_id}
                  className="bg-fdp-surface-2 rounded-lg p-4 border border-fdp-border-1"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-fdp-text-1 capitalize">
                      {exp.variant_id.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-bold text-fdp-accent-1">
                      {exp.conversion_rate}% CVR
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-fdp-text-3 mb-3">
                    <div>
                      <div className="font-semibold text-fdp-text-2">
                        {exp.impressions}
                      </div>
                      <div>Impressions</div>
                    </div>
                    <div>
                      <div className="font-semibold text-fdp-text-2">
                        {exp.clicks}
                      </div>
                      <div>Clicks</div>
                    </div>
                    <div>
                      <div className="font-semibold text-fdp-text-2">
                        {exp.conversions}
                      </div>
                      <div>Conversions</div>
                    </div>
                  </div>

                  <div className="h-2 bg-fdp-bg-0 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2"
                      style={{ width: `${exp.conversion_rate}%` }}
                    />
                  </div>

                  {exp.conversion_rate === Math.max(...experiments.map(e => e.conversion_rate)) && exp.impressions > 100 && (
                    <div className="text-xs text-green-500 font-semibold">
                      🏆 Best Performer
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-fdp-text-3">
              No experiment data yet. Start testing!
            </div>
          )}
        </div>
      </div>

      <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
        <h3 className="text-lg font-bold text-fdp-text-1 mb-4">
          Daily Conversion Trends
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-fdp-border-1">
                <th className="text-left py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Date
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Sessions
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Conversions
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  CVR
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  High Intent
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, index) => (
                <tr key={index} className="border-b border-fdp-border-1 hover:bg-fdp-surface-2">
                  <td className="py-3 px-4 text-sm text-fdp-text-2">
                    {new Date(metric.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {metric.total_sessions}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {metric.converted_sessions}
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-fdp-accent-1 text-right">
                    {metric.conversion_rate}%
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {metric.high_intent_sessions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
