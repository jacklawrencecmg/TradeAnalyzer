/**
 * Complete Step
 *
 * Victory screen showing:
 * - You're ready!
 * - 2 Buy Lows, 1 Trade Opportunity, 1 Waiver Upgrade
 * - CTA to dashboard
 */

import React from 'react';
import { CheckCircle, TrendingUp, Target, Users } from 'lucide-react';

export function CompleteStep({ leagueId }: { leagueId: string | null }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircle className="w-12 h-12" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">You're Ready!</h1>
        <p className="text-xl text-gray-600 mb-12">
          Your personalized dynasty dashboard is ready
        </p>

        {/* Opportunities Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 mb-8 text-left">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Waiting for you on the dashboard:
          </h2>

          <div className="space-y-4">
            <OpportunitySummary
              icon={<TrendingUp className="w-6 h-6 text-green-600" />}
              count={2}
              label="Buy Low Opportunities"
              description="Undervalued players ready to acquire"
            />

            <OpportunitySummary
              icon={<Users className="w-6 h-6 text-blue-600" />}
              count={1}
              label="Trade Opportunity"
              description="Fair trade available with league mate"
            />

            <OpportunitySummary
              icon={<Target className="w-6 h-6 text-purple-600" />}
              count={1}
              label="Waiver Upgrade"
              description="Better player available than roster starter"
            />
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            Go to Dashboard
          </button>

          <p className="text-sm text-gray-600">
            Tip: Add players to your watchlist to get personalized alerts
          </p>
        </div>
      </div>

      {/* What's Next */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-gray-900 mb-3">What to explore next:</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Trade Calculator — Evaluate any trade with league-aware values</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Player Rankings — See top 1000 players adjusted for your league</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Team Advice — Get personalized buy/sell/hold recommendations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            <span>Watchlist — Follow key players and get alerts on opportunities</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function OpportunitySummary({
  icon,
  count,
  label,
  description,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-lg">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl font-bold text-gray-900">{count}</span>
          <span className="font-semibold text-gray-900">{label}</span>
        </div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
    </div>
  );
}

export default CompleteStep;
