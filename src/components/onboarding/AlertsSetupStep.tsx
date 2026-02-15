/**
 * Alerts Setup Step
 *
 * Opt-in to notifications AFTER seeing value
 * Timing matters - user now understands benefit
 */

import React, { useState } from 'react';
import { Bell, TrendingUp, Target, Star } from 'lucide-react';

export function AlertsSetupStep({ onNext }: { onNext: () => void }) {
  const [enableAlerts, setEnableAlerts] = useState(true);

  function handleContinue() {
    onNext({ alertsConfigured: enableAlerts });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Stay Ahead of Opportunities</h1>
        <p className="text-lg text-gray-600">
          Get notified when your team can improve
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          What you'll be notified about:
        </h2>

        <div className="space-y-4 mb-8">
          <AlertType
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            title="Buy Low Opportunities"
            description="When watched players become undervalued"
          />

          <AlertType
            icon={<Target className="w-6 h-6 text-blue-600" />}
            title="Value Changes"
            description="Significant changes (300+ points) for watched players"
          />

          <AlertType
            icon={<Star className="w-6 h-6 text-purple-600" />}
            title="Breakout Alerts"
            description="Players about to surge in value (72h expires)"
          />

          <AlertType
            icon={<Bell className="w-6 h-6 text-yellow-600" />}
            title="Daily Digest"
            description="Morning summary of all opportunities (6 AM)"
          />
        </div>

        {/* Toggle */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <label className="flex items-center gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={enableAlerts}
              onChange={(e) => setEnableAlerts(e.target.checked)}
              className="w-6 h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="font-semibold text-gray-900">
                Enable personalized alerts
              </div>
              <div className="text-sm text-gray-600">
                You can customize this later in settings
              </div>
            </div>
          </label>
        </div>

        {/* Free vs Premium */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">FREE</div>
            <div className="text-2xl font-bold text-gray-900 mb-3">5 alerts/day</div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Critical/High priority only</li>
              <li>• Hourly batch delivery</li>
              <li>• Breakout alerts</li>
            </ul>
          </div>

          <div className="border-2 border-blue-600 rounded-lg p-4 bg-blue-50">
            <div className="text-sm font-semibold text-blue-600 mb-2">PREMIUM</div>
            <div className="text-2xl font-bold text-gray-900 mb-3">50 alerts/day</div>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• All priority levels</li>
              <li>• Real-time delivery</li>
              <li>• Early access to buy lows</li>
              <li>• League-aware opportunities</li>
            </ul>
          </div>
        </div>

        <button
          onClick={handleContinue}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {enableAlerts ? 'Enable Alerts & Continue' : 'Skip Alerts'}
        </button>
      </div>
    </div>
  );
}

function AlertType({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-gray-900 mb-1">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
    </div>
  );
}

export default AlertsSetupStep;
