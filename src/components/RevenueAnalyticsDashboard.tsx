import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  MousePointerClick,
  Calendar,
  Activity,
  ArrowUp,
  ArrowDown,
  Eye,
  Target,
  Zap,
} from 'lucide-react';
import {
  getRevenueInsights,
  getCTAPerformance,
  getUpgradeEvents,
  RevenueInsights,
  CTAPerformance,
  UpgradeEvent,
} from '../lib/attribution';

export function RevenueAnalyticsDashboard() {
  const [insights, setInsights] = useState<RevenueInsights | null>(null);
  const [ctaPerformance, setCtaPerformance] = useState<CTAPerformance[]>([]);
  const [recentUpgrades, setRecentUpgrades] = useState<UpgradeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  useEffect(() => {
    loadData();
  }, [daysBack]);

  async function loadData() {
    setLoading(true);
    try {
      const [insightsData, ctaData, upgradesData] = await Promise.all([
        getRevenueInsights(daysBack),
        getCTAPerformance(),
        getUpgradeEvents(20),
      ]);

      setInsights(insightsData);
      setCtaPerformance(ctaData);
      setRecentUpgrades(upgradesData);
    } catch (error) {
      console.error('Failed to load revenue analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-fdp-text-3">Loading revenue analytics...</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-6 text-center">
        <p className="text-fdp-text-3">No revenue data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-fdp-text-1">
          Revenue Analytics
        </h1>

        <select
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value))}
          className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg px-4 py-2 text-fdp-text-1"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fdp-text-1">
                ${insights.total_revenue.toLocaleString()}
              </div>
              <div className="text-sm text-fdp-text-3">Total Revenue</div>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fdp-text-1">
                {insights.total_upgrades}
              </div>
              <div className="text-sm text-fdp-text-3">Total Upgrades</div>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fdp-text-1">
                {insights.avg_days_to_upgrade.toFixed(1)}
              </div>
              <div className="text-sm text-fdp-text-3">Avg Days to Upgrade</div>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fdp-text-1">
                {insights.avg_actions_to_upgrade.toFixed(1)}
              </div>
              <div className="text-sm text-fdp-text-3">Avg Actions Before Upgrade</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Upgrade Triggers
          </h3>

          <div className="space-y-3">
            {Object.entries(insights.upgrades_by_trigger || {})
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([trigger, count]) => {
                const triggerInfo = insights.conversion_rate_by_trigger?.[trigger];
                return (
                  <div key={trigger} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-fdp-text-1 text-sm">
                        {trigger.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                      {triggerInfo && (
                        <div className="text-xs text-fdp-text-3">
                          Avg {triggerInfo.avg_days} days to convert
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-fdp-text-1">{count}</span>
                      <div className="w-16 h-2 bg-fdp-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-fdp-accent-1"
                          style={{
                            width: `${(count / insights.total_upgrades) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            <MousePointerClick className="w-5 h-5" />
            Top CTAs
          </h3>

          {insights.best_performing_cta && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span className="font-semibold text-green-700 text-sm">
                  Best Performer
                </span>
              </div>
              <div className="font-bold text-fdp-text-1 mb-1">
                {insights.best_performing_cta.cta_text}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-semibold">
                  {insights.best_performing_cta.conversion_rate}% conversion
                </span>
                <span className="text-fdp-text-3">
                  {insights.best_performing_cta.conversions} conversions
                </span>
                <span className="text-fdp-text-3">
                  ${insights.best_performing_cta.revenue.toLocaleString()} revenue
                </span>
              </div>
            </div>
          )}

          {insights.worst_performing_cta && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-red-700 text-sm">
                  Needs Improvement
                </span>
              </div>
              <div className="font-bold text-fdp-text-1 mb-1">
                {insights.worst_performing_cta.cta_text}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-red-600 font-semibold">
                  {insights.worst_performing_cta.conversion_rate}% conversion
                </span>
                <span className="text-fdp-text-3">
                  {insights.worst_performing_cta.conversions} conversions
                </span>
                <span className="text-fdp-text-3">
                  {insights.worst_performing_cta.impressions} impressions
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
        <h3 className="text-lg font-bold text-fdp-text-1 mb-4">
          CTA Performance Details
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-fdp-border-1">
                <th className="text-left py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  CTA Text
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Type
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  <Eye className="w-4 h-4 inline mr-1" />
                  Impressions
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  <MousePointerClick className="w-4 h-4 inline mr-1" />
                  Clicks
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  Conversions
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  CTR
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Conv Rate
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-fdp-text-2">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {ctaPerformance.slice(0, 15).map((cta) => (
                <tr key={cta.cta_id} className="border-b border-fdp-border-1">
                  <td className="py-3 px-4 text-sm text-fdp-text-1 font-medium">
                    {cta.cta_text}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-3">
                    {cta.cta_type}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {cta.impressions.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {cta.clicks.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right">
                    {cta.conversions.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <span
                      className={`font-semibold ${
                        cta.click_through_rate! > 10
                          ? 'text-green-600'
                          : cta.click_through_rate! > 5
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}
                    >
                      {cta.click_through_rate?.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-right">
                    <span
                      className={`font-semibold ${
                        cta.conversion_rate! > 15
                          ? 'text-green-600'
                          : cta.conversion_rate! > 5
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}
                    >
                      {cta.conversion_rate?.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-fdp-text-1 text-right font-semibold">
                    ${cta.revenue_generated.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-xl p-6">
        <h3 className="text-lg font-bold text-fdp-text-1 mb-4">
          Recent Upgrades
        </h3>

        <div className="space-y-3">
          {recentUpgrades.map((upgrade) => (
            <div
              key={upgrade.event_id}
              className="flex items-start gap-4 p-4 bg-fdp-surface-2 rounded-lg border border-fdp-border-1"
            >
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <ArrowUp className="w-5 h-5 text-green-500" />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-fdp-text-1">
                      {upgrade.trigger_event.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <div className="text-sm text-fdp-text-3">
                      {upgrade.days_since_signup} days since signup • {upgrade.session_actions} sessions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      ${upgrade.revenue_amount.toFixed(2)}
                    </div>
                    {upgrade.trial_converted && (
                      <div className="text-xs text-orange-600 font-semibold">
                        Trial → Paid
                      </div>
                    )}
                  </div>
                </div>

                {upgrade.cta_clicked && (
                  <div className="text-xs text-fdp-text-3">
                    CTA: {upgrade.cta_clicked}
                  </div>
                )}

                <div className="text-xs text-fdp-text-3 mt-1">
                  {new Date(upgrade.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
