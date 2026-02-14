import { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { getSystemHealthStatus, runSystemHealthChecks, type SystemHealthSummary } from '../lib/health/runHealthChecks';

interface StartupValidatorProps {
  onValidationComplete: (status: SystemHealthSummary | null) => void;
}

export default function StartupValidator({ onValidationComplete }: StartupValidatorProps) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'warning' | 'critical'>('checking');
  const [healthStatus, setHealthStatus] = useState<SystemHealthSummary | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    performStartupValidation();
  }, []);

  async function performStartupValidation() {
    try {
      let health = await getSystemHealthStatus();

      if (!health) {
        health = await runSystemHealthChecks();
      }

      setHealthStatus(health);

      if (health.overall_status === 'critical') {
        setStatus('critical');
      } else if (health.overall_status === 'warning') {
        setStatus('warning');
        setTimeout(() => {
          onValidationComplete(health);
        }, 1000);
      } else {
        setStatus('ok');
        setTimeout(() => {
          onValidationComplete(health);
        }, 500);
      }
    } catch (err) {
      console.error('Startup validation error:', err);
      setStatus('warning');
      setTimeout(() => {
        onValidationComplete(null);
      }, 1000);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    setStatus('checking');
    await performStartupValidation();
    setRetrying(false);
  }

  if (status === 'ok') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">System Healthy</h2>
            <p className="text-gray-600">All systems operational</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Validating System</h2>
            <p className="text-gray-600">Running health checks...</p>
          </div>
          <div className="space-y-2 text-sm text-gray-500">
            <p>✓ Checking database connectivity</p>
            <p>✓ Verifying data freshness</p>
            <p>✓ Validating system state</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'warning') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Minor Issues Detected</h2>
            <p className="text-gray-600">System is operational with warnings</p>
          </div>
          {healthStatus && (
            <div className="bg-yellow-50 rounded-lg p-4 text-left mb-4">
              <p className="text-sm font-medium text-yellow-900 mb-2">Warning Details:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {healthStatus.checks
                  .filter(c => c.status === 'warning')
                  .map((check, index) => (
                    <li key={index}>• {check.message}</li>
                  ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-gray-500">Loading application...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Critical Issues Detected</h2>
          <p className="text-gray-600">System is in safe mode</p>
        </div>

        {healthStatus && (
          <div className="bg-red-50 rounded-lg p-4 text-left mb-6">
            <p className="text-sm font-medium text-red-900 mb-2">Critical Issues:</p>
            <ul className="text-sm text-red-800 space-y-1">
              {healthStatus.checks
                .filter(c => c.status === 'critical')
                .map((check, index) => (
                  <li key={index}>• {check.message}</li>
                ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry Validation'}
          </button>

          <button
            onClick={() => onValidationComplete(healthStatus)}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Continue Anyway (Read-Only)
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Some features are disabled to prevent data corruption.
          Contact your administrator for assistance.
        </p>
      </div>
    </div>
  );
}
