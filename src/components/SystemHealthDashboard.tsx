import { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';
import { runSystemHealthChecks, getSystemHealthStatus, type SystemHealthSummary, type HealthCheckResult } from '../lib/health/runHealthChecks';
import { attemptAutoRecovery, type RecoveryAttempt } from '../lib/health/autoRecovery';
import { supabase } from '../lib/supabase';

interface Alert {
  id: string;
  severity: string;
  check_name: string;
  message: string;
  created_at: string;
  age_seconds: number;
}

export default function SystemHealthDashboard() {
  const [healthStatus, setHealthStatus] = useState<SystemHealthSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [recoveryAttempts, setRecoveryAttempts] = useState<RecoveryAttempt[]>([]);
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    loadHealthData();
    checkSafeMode();
    const interval = setInterval(() => {
      loadHealthData();
      checkSafeMode();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadHealthData() {
    try {
      const [status, alertsData] = await Promise.all([
        getSystemHealthStatus(),
        supabase.from('active_system_alerts').select('*'),
      ]);

      if (status) {
        setHealthStatus(status);
        setLastRun(status.checked_at);
      }

      if (alertsData.data) {
        setAlerts(alertsData.data);
      }
    } catch (err) {
      console.error('Error loading health data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function checkSafeMode() {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'safe_mode')
        .maybeSingle();

      if (data?.value) {
        setSafeMode(data.value.enabled || false);
      }
    } catch (err) {
      console.error('Error checking safe mode:', err);
    }
  }

  async function handleRunChecks() {
    setRunning(true);
    setRecoveryAttempts([]);
    try {
      const result = await runSystemHealthChecks();
      setHealthStatus(result);
      setLastRun(result.checked_at);
      await loadHealthData();
    } catch (err) {
      console.error('Error running health checks:', err);
    } finally {
      setRunning(false);
    }
  }

  async function handleAutoRecover() {
    setRecovering(true);
    try {
      const attempts = await attemptAutoRecovery();
      setRecoveryAttempts(attempts);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await handleRunChecks();
    } catch (err) {
      console.error('Error attempting auto recovery:', err);
    } finally {
      setRecovering(false);
    }
  }

  async function handleResolveAlert(alertId: string) {
    try {
      await supabase
        .from('system_alerts')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);
      await loadHealthData();
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ok':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleString();
  }

  function formatCheckName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="w-8 h-8" />
            System Health Monitor
          </h1>
          {lastRun && (
            <p className="text-sm text-gray-600 mt-1">
              Last checked: {formatTimestamp(lastRun)}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAutoRecover}
            disabled={recovering || running}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {recovering ? 'Recovering...' : 'Auto Recover'}
          </button>
          <button
            onClick={handleRunChecks}
            disabled={running || recovering}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running...' : 'Run Checks Now'}
          </button>
        </div>
      </div>

      {safeMode && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Safe Mode Active</p>
            <p className="text-sm text-red-700">
              Critical issues detected. Some features are disabled until issues are resolved.
            </p>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Active Alerts ({alerts.length})
          </h2>

          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {alert.severity === 'critical' ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      )}
                      <span className="font-semibold text-gray-900 capitalize">
                        {formatCheckName(alert.check_name)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created {formatTimestamp(alert.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleResolveAlert(alert.id)}
                    className="ml-4 px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recoveryAttempts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Recovery Attempts
          </h2>

          <div className="space-y-3">
            {recoveryAttempts.map((attempt, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  attempt.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {attempt.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {formatCheckName(attempt.check_name)}
                  </span>
                  <span className="text-sm text-gray-600">
                    {attempt.action_taken}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{attempt.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {healthStatus && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Health Checks</h2>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600">OK: {healthStatus.ok_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-600">Warning: {healthStatus.warning_count}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600">Critical: {healthStatus.critical_count}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {healthStatus.checks.map((check, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getStatusColor(check.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(check.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{formatCheckName(check.check_name)}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            check.status === 'ok'
                              ? 'bg-green-100 text-green-800'
                              : check.status === 'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {check.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm">{check.message}</p>
                      {check.meta && Object.keys(check.meta).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer hover:underline">
                            Show details
                          </summary>
                          <pre className="text-xs mt-2 p-2 bg-white bg-opacity-50 rounded overflow-x-auto">
                            {JSON.stringify(check.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          About Health Monitoring
        </h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            The system health monitor runs automatically every hour to detect issues before they affect users.
          </p>
          <p>
            <strong>Auto Recovery:</strong> Warning-level issues trigger automatic recovery attempts.
            Critical issues require manual intervention.
          </p>
          <p>
            <strong>Safe Mode:</strong> When critical issues are detected, certain features are automatically
            disabled to prevent bad data from reaching users.
          </p>
        </div>
      </div>
    </div>
  );
}
