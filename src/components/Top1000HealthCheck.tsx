import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity, Database, TrendingUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  checks: {
    players_sync: CheckResult;
    values_sync: CheckResult;
    coverage: CheckResult;
    unresolved: CheckResult;
  };
  last_checked: string;
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

export default function Top1000HealthCheck() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runHealthCheck();
    // Auto-refresh every 5 minutes
    const interval = setInterval(runHealthCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function runHealthCheck() {
    setLoading(true);
    setError(null);

    try {
      // Check 1: Last players sync
      const playersCheck = await checkPlayersSyncRecency();

      // Check 2: Last values sync
      const valuesCheck = await checkValuesSyncRecency();

      // Check 3: Coverage
      const coverageCheck = await checkValuesCoverage();

      // Check 4: Unresolved entities
      const unresolvedCheck = await checkUnresolvedEntities();

      // Determine overall status
      const checks = {
        players_sync: playersCheck,
        values_sync: valuesCheck,
        coverage: coverageCheck,
        unresolved: unresolvedCheck,
      };

      const hasError = Object.values(checks).some(c => c.status === 'fail');
      const hasWarning = Object.values(checks).some(c => c.status === 'warn');

      const overallStatus: 'healthy' | 'warning' | 'error' = hasError
        ? 'error'
        : hasWarning
        ? 'warning'
        : 'healthy';

      setHealth({
        status: overallStatus,
        checks,
        last_checked: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Health check failed:', err);
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  }

  async function checkPlayersSyncRecency(): Promise<CheckResult> {
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('completed_at, status, error_message')
        .eq('sync_type', 'sleeper_players')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          status: 'fail',
          message: 'No player sync found',
        };
      }

      const lastSync = new Date(data.completed_at);
      const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

      if (data.status === 'error') {
        return {
          status: 'fail',
          message: `Last sync failed: ${data.error_message || 'Unknown error'}`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      if (hoursAgo > 26) {
        return {
          status: 'fail',
          message: `Player sync outdated (${hoursAgo.toFixed(1)}h ago)`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      if (hoursAgo > 18) {
        return {
          status: 'warn',
          message: `Player sync aging (${hoursAgo.toFixed(1)}h ago)`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      return {
        status: 'pass',
        message: `Players synced ${hoursAgo.toFixed(1)}h ago`,
        details: { hours_ago: hoursAgo.toFixed(1) },
      };
    } catch (err) {
      return {
        status: 'fail',
        message: `Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  async function checkValuesSyncRecency(): Promise<CheckResult> {
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('completed_at, status, error_message')
        .eq('sync_type', 'build_top1000')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          status: 'fail',
          message: 'No values sync found',
        };
      }

      const lastSync = new Date(data.completed_at);
      const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

      if (data.status === 'error') {
        return {
          status: 'fail',
          message: `Last build failed: ${data.error_message || 'Unknown error'}`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      if (hoursAgo > 18) {
        return {
          status: 'fail',
          message: `Values build outdated (${hoursAgo.toFixed(1)}h ago)`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      if (hoursAgo > 12) {
        return {
          status: 'warn',
          message: `Values build aging (${hoursAgo.toFixed(1)}h ago)`,
          details: { hours_ago: hoursAgo.toFixed(1) },
        };
      }

      return {
        status: 'pass',
        message: `Values built ${hoursAgo.toFixed(1)}h ago`,
        details: { hours_ago: hoursAgo.toFixed(1) },
      };
    } catch (err) {
      return {
        status: 'fail',
        message: `Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  async function checkValuesCoverage(): Promise<CheckResult> {
    try {
      // Count players by position
      const { data: players, error: playersError } = await supabase
        .from('nfl_players')
        .select('player_position')
        .in('status', ['Active', 'IR', 'PUP']);

      if (playersError) throw playersError;

      // Count value snapshots
      const { count: valuesCount, error: valuesError } = await supabase
        .from('value_snapshots')
        .select('*', { count: 'exact', head: true })
        .gte('captured_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (valuesError) throw valuesError;

      const totalPlayers = players?.length || 0;
      const recentValues = valuesCount || 0;

      if (totalPlayers === 0) {
        return {
          status: 'fail',
          message: 'No players in database',
        };
      }

      const coverage = recentValues / totalPlayers;

      if (coverage < 0.5) {
        return {
          status: 'fail',
          message: `Low coverage: ${(coverage * 100).toFixed(0)}% (${recentValues}/${totalPlayers})`,
          details: { coverage, recent_values: recentValues, total_players: totalPlayers },
        };
      }

      if (coverage < 0.75) {
        return {
          status: 'warn',
          message: `Fair coverage: ${(coverage * 100).toFixed(0)}% (${recentValues}/${totalPlayers})`,
          details: { coverage, recent_values: recentValues, total_players: totalPlayers },
        };
      }

      return {
        status: 'pass',
        message: `Good coverage: ${(coverage * 100).toFixed(0)}% (${recentValues}/${totalPlayers})`,
        details: { coverage, recent_values: recentValues, total_players: totalPlayers },
      };
    } catch (err) {
      return {
        status: 'fail',
        message: `Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  async function checkUnresolvedEntities(): Promise<CheckResult> {
    try {
      const { count, error } = await supabase
        .from('unresolved_entities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      if (error) throw error;

      const unresolvedCount = count || 0;

      if (unresolvedCount > 100) {
        return {
          status: 'fail',
          message: `High unresolved count: ${unresolvedCount}`,
          details: { count: unresolvedCount },
        };
      }

      if (unresolvedCount > 50) {
        return {
          status: 'warn',
          message: `Moderate unresolved count: ${unresolvedCount}`,
          details: { count: unresolvedCount },
        };
      }

      return {
        status: 'pass',
        message: `Low unresolved count: ${unresolvedCount}`,
        details: { count: unresolvedCount },
      };
    } catch (err) {
      return {
        status: 'fail',
        message: `Check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  if (loading && !health) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#00d4ff]" />
          <span className="text-gray-300">Running health checks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-400">Health Check Failed</p>
            <p className="text-sm text-red-300 mt-1">{error}</p>
            <button
              onClick={runHealthCheck}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const StatusIcon = health.status === 'healthy' ? CheckCircle : health.status === 'warning' ? AlertTriangle : XCircle;
  const statusColor =
    health.status === 'healthy' ? 'text-green-400' : health.status === 'warning' ? 'text-yellow-400' : 'text-red-400';
  const borderColor =
    health.status === 'healthy' ? 'border-green-500' : health.status === 'warning' ? 'border-yellow-500' : 'border-red-500';
  const bgColor =
    health.status === 'healthy' ? 'bg-green-900/20' : health.status === 'warning' ? 'bg-yellow-900/20' : 'bg-red-900/20';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#00d4ff]" />
          <div>
            <h3 className="text-xl font-bold text-white">System Health</h3>
            <p className="text-xs text-gray-400 mt-1">
              Last checked: {new Date(health.last_checked).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-8 h-8 ${statusColor}`} />
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Players Sync Check */}
        <HealthCheckCard
          icon={<Database className="w-5 h-5" />}
          title="Players Sync"
          check={health.checks.players_sync}
        />

        {/* Values Sync Check */}
        <HealthCheckCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="Values Build"
          check={health.checks.values_sync}
        />

        {/* Coverage Check */}
        <HealthCheckCard
          icon={<Activity className="w-5 h-5" />}
          title="Coverage"
          check={health.checks.coverage}
        />

        {/* Unresolved Check */}
        <HealthCheckCard
          icon={<AlertCircle className="w-5 h-5" />}
          title="Unresolved Entities"
          check={health.checks.unresolved}
        />
      </div>
    </div>
  );
}

function HealthCheckCard({ icon, title, check }: { icon: React.ReactNode; title: string; check: CheckResult }) {
  const StatusIcon = check.status === 'pass' ? CheckCircle : check.status === 'warn' ? AlertTriangle : XCircle;
  const statusColor = check.status === 'pass' ? 'text-green-400' : check.status === 'warn' ? 'text-yellow-400' : 'text-red-400';
  const bgColor = check.status === 'pass' ? 'bg-gray-800' : check.status === 'warn' ? 'bg-yellow-900/10' : 'bg-red-900/10';

  return (
    <div className={`${bgColor} rounded-lg p-4 border border-gray-700`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="font-semibold text-white text-sm">{title}</h4>
      </div>
      <div className="flex items-start gap-2">
        <StatusIcon className={`w-5 h-5 ${statusColor} flex-shrink-0 mt-0.5`} />
        <p className="text-sm text-gray-300">{check.message}</p>
      </div>
    </div>
  );
}
