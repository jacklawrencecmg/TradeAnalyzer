import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, RefreshCw, Database, TrendingUp, Activity, CheckCircle, XCircle, AlertCircle, Clock, Calendar, Shield, List } from 'lucide-react';
import { clearPlayerCache } from '../services/sleeperApi';
import { invalidateEnrichedPlayersCache } from '../lib/players/getEnrichedPlayers';
import SeasonRollover from './SeasonRollover';
import ValueValidation from './ValueValidation';
import Top1000HealthCheck from './Top1000HealthCheck';
import SeasonRolloverAdmin from './SeasonRolloverAdmin';

interface SyncStatus {
  last_player_sync?: string;
  last_value_sync?: string;
  player_count?: number;
  value_snapshot_count?: number;
  unresolved_count?: number;
  position_coverage?: Record<string, number>;
}

interface SyncResult {
  success: boolean;
  steps?: any[];
  totals?: any;
  positions?: any;
  [key: string]: any;
}

export function AdminSyncHub() {
  const [status, setStatus] = useState<SyncStatus>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      setError(null);

      const { data: playerSync } = await supabase
        .from('nfl_players')
        .select('last_seen_at')
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: valueSync } = await supabase
        .from('ktc_value_snapshots')
        .select('captured_at')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: playerCount } = await supabase
        .from('nfl_players')
        .select('*', { count: 'exact', head: true });

      const { count: valueCount } = await supabase
        .from('ktc_value_snapshots')
        .select('*', { count: 'exact', head: true });

      const { count: unresolvedCount } = await supabase
        .from('unresolved_entities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      const { data: positionCoverage } = await supabase
        .from('nfl_players')
        .select('player_position')
        .eq('status', 'Active');

      const coverage: Record<string, number> = {};
      positionCoverage?.forEach((p: any) => {
        coverage[p.player_position] = (coverage[p.player_position] || 0) + 1;
      });

      setStatus({
        last_player_sync: playerSync?.last_seen_at,
        last_value_sync: valueSync?.captured_at,
        player_count: playerCount || 0,
        value_snapshot_count: valueCount || 0,
        unresolved_count: unresolvedCount || 0,
        position_coverage: coverage,
      });
    } catch (err: any) {
      console.error('Error loading status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSync(type: 'players' | 'values' | 'full' | 'rebuild') {
    try {
      setSyncing(type);
      setError(null);
      setLastResult(null);

      const functionMap = {
        players: 'sync-sleeper-players',
        values: 'sync-values-all',
        full: 'sync-full-pipeline',
        rebuild: 'rebuild-player-values-v2',
      };

      const functionName = functionMap[type];
      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) {
        throw error;
      }

      setLastResult(data);

      // Clear player caches after sync to ensure fresh data
      if (type === 'players' || type === 'full') {
        clearPlayerCache();
        invalidateEnrichedPlayersCache();
        console.log('Player caches cleared - team data will be refreshed on next request');
      }

      await loadStatus();

      if (!data.success) {
        setError('Sync completed with errors. Check result details below.');
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  }

  function getTimeSince(timestamp?: string): string {
    if (!timestamp) return 'Never';

    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 48) {
      return `${Math.floor(diffHours / 24)} days ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m ago`;
    } else {
      return `${diffMins}m ago`;
    }
  }

  function getStatusColor(timestamp?: string): string {
    if (!timestamp) return 'text-gray-500';

    const now = new Date();
    const then = new Date(timestamp);
    const diffHours = (now.getTime() - then.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return 'text-green-600';
    if (diffHours < 48) return 'text-yellow-600';
    return 'text-red-600';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sync Hub</h1>
        <button
          onClick={loadStatus}
          disabled={syncing !== null}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Player Registry</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Players</p>
              <p className="text-2xl font-bold text-gray-900">{status.player_count?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Sync</p>
              <p className={`text-sm font-medium ${getStatusColor(status.last_player_sync)}`}>
                {getTimeSince(status.last_player_sync)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Value Snapshots</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Snapshots</p>
              <p className="text-2xl font-bold text-gray-900">{status.value_snapshot_count?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Sync</p>
              <p className={`text-sm font-medium ${getStatusColor(status.last_value_sync)}`}>
                {getTimeSince(status.last_value_sync)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Unresolved Entities</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Open Issues</p>
              <p className={`text-2xl font-bold ${status.unresolved_count && status.unresolved_count > 50 ? 'text-red-600' : 'text-gray-900'}`}>
                {status.unresolved_count}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className={`text-sm font-medium ${status.unresolved_count && status.unresolved_count > 50 ? 'text-red-600' : 'text-green-600'}`}>
                {status.unresolved_count && status.unresolved_count > 50 ? 'Needs Attention' : 'Good'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {status.position_coverage && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Position Coverage</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['QB', 'RB', 'WR', 'TE'].map(pos => (
              <div key={pos} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">{pos}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {status.position_coverage?.[pos] || 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Sync Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => runSync('players')}
            disabled={syncing !== null}
            className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-8 h-8 text-blue-600" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Sync Players</h3>
              <p className="text-sm text-gray-600 mt-1">Update rosters, teams, and status</p>
            </div>
            {syncing === 'players' && (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            )}
          </button>

          <button
            onClick={() => runSync('values')}
            disabled={syncing !== null}
            className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Sync Values</h3>
              <p className="text-sm text-gray-600 mt-1">Scrape KTC rankings</p>
            </div>
            {syncing === 'values' && (
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
            )}
          </button>

          <button
            onClick={() => runSync('rebuild')}
            disabled={syncing !== null}
            className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-lg hover:border-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield className="w-8 h-8 text-[#00d4ff]" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Rebuild Player Values</h3>
              <p className="text-sm text-gray-600 mt-1">Full rebuild with validation</p>
            </div>
            {syncing === 'rebuild' && (
              <Loader2 className="w-5 h-5 animate-spin text-[#00d4ff]" />
            )}
          </button>

          <button
            onClick={() => runSync('full')}
            disabled={syncing !== null}
            className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className="w-8 h-8 text-purple-600" />
            <div className="text-center">
              <h3 className="font-semibold text-gray-900">Full Pipeline</h3>
              <p className="text-sm text-gray-600 mt-1">Run all syncs + trends</p>
            </div>
            {syncing === 'full' && (
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            )}
          </button>
        </div>
      </div>

      {lastResult && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Last Sync Result</h2>

          {lastResult.steps && (
            <div className="space-y-3">
              {lastResult.steps.map((step: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  {step.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />}
                  {step.status === 'failed' && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                  {step.status === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                  {step.status === 'error' && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{step.name.replace(/_/g, ' ')}</h3>
                      {step.duration_ms && (
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {(step.duration_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {step.result && (
                      <div className="mt-2 text-sm text-gray-700">
                        {JSON.stringify(step.result, null, 2)}
                      </div>
                    )}

                    {step.error && (
                      <p className="mt-2 text-sm text-red-600">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastResult.totals && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Totals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Inserted</p>
                  <p className="font-semibold text-gray-900">{lastResult.totals.inserted}</p>
                </div>
                <div>
                  <p className="text-gray-600">Updated</p>
                  <p className="font-semibold text-gray-900">{lastResult.totals.updated}</p>
                </div>
                <div>
                  <p className="text-gray-600">Unresolved</p>
                  <p className="font-semibold text-gray-900">{lastResult.totals.unresolved}</p>
                </div>
                <div>
                  <p className="text-gray-600">Errors</p>
                  <p className="font-semibold text-gray-900">{lastResult.totals.errors}</p>
                </div>
              </div>
            </div>
          )}

          {lastResult.positions && (
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-gray-900">Position Details</h4>
              {Object.entries(lastResult.positions).map(([pos, details]: [string, any]) => (
                <div key={pos} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{pos}</span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      details.status === 'success' ? 'bg-green-100 text-green-700' :
                      details.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {details.status}
                    </span>
                  </div>
                  {details.scraped && (
                    <p className="text-sm text-gray-600 mt-1">
                      Scraped: {details.scraped} | Max Rank: {details.maxRank}
                    </p>
                  )}
                  {details.message && (
                    <p className="text-sm text-gray-600 mt-1">{details.message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top 1000 Health Check */}
      <div className="mt-6">
        <Top1000HealthCheck />
      </div>

      {/* Season Rollover & Value Rebuild */}
      <div className="mt-6">
        <SeasonRolloverAdmin />
      </div>
    </div>
  );
}
