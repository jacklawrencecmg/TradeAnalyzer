import { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, CheckCircle, RefreshCw, Database, TrendingUp, Info, Play } from 'lucide-react';
import { SEASON_CONTEXT, getSeasonContextSummary, needsSeasonalRebuild } from '../config/seasonContext';
import { supabase } from '../lib/supabase';

export default function SeasonRolloverAdmin() {
  const [loading, setLoading] = useState(false);
  const [rebuildStatus, setRebuildStatus] = useState<any>(null);
  const [rolloverStatus, setRolloverStatus] = useState<any>(null);
  const [needsRebuild, setNeedsRebuild] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadStatus();
    setNeedsRebuild(needsSeasonalRebuild());
  }, []);

  async function loadStatus() {
    // Get last rebuild status
    const { data: rebuild } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'rebuild_all_values_post_2025')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setRebuildStatus(rebuild);

    // Get last rollover status
    const { data: rollover } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'season_rollover')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setRolloverStatus(rollover);
  }

  async function triggerRebuild() {
    if (!confirmRebuild) {
      alert('Please check the confirmation box to proceed');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/rebuild-player-values`;
      const adminSecret = import.meta.env.VITE_ADMIN_SYNC_SECRET || 'admin-secret-key';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setResult(data);

      // Reload status
      setTimeout(loadStatus, 2000);
    } catch (error) {
      console.error('Rebuild failed:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
      setConfirmRebuild(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Season Context */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-6 h-6 text-[#00d4ff]" />
          <h2 className="text-xl font-bold text-white">Season Context</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">League Year</div>
            <div className="text-2xl font-bold text-white">{SEASON_CONTEXT.league_year}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Last Completed</div>
            <div className="text-2xl font-bold text-white">{SEASON_CONTEXT.last_completed_season}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Phase</div>
            <div className="text-lg font-bold text-[#00d4ff] capitalize">{SEASON_CONTEXT.phase}</div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Value Epoch</div>
            <div className="text-lg font-bold text-green-400">{SEASON_CONTEXT.value_epoch}</div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <strong>Invalidation Cutoff:</strong> All values before {SEASON_CONTEXT.invalidate_before} are
              considered stale and have been archived. Only production-based values from the {SEASON_CONTEXT.last_completed_season} season are active.
            </div>
          </div>
        </div>
      </div>

      {/* Rebuild Alert */}
      {needsRebuild && (
        <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-yellow-400 mb-2">Season Rebuild Required</h3>
              <p className="text-sm text-yellow-300 mb-3">
                The {SEASON_CONTEXT.last_completed_season} season has ended. Player values should be rebuilt using
                current season performance data instead of preseason projections.
              </p>
              <p className="text-sm text-yellow-300">
                This will recalculate all player values based on actual production metrics with proper weighting:
                65% season stats, 20% opportunity metrics, 10% age curve, 5% situation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rebuild Status */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Value Rebuild</h2>
          </div>
          {rebuildStatus && (
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              rebuildStatus.status === 'success'
                ? 'bg-green-900/30 text-green-400'
                : rebuildStatus.status === 'error'
                ? 'bg-red-900/30 text-red-400'
                : 'bg-yellow-900/30 text-yellow-400'
            }`}>
              {rebuildStatus.status}
            </span>
          )}
        </div>

        {rebuildStatus ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Last Run</div>
                <div className="text-sm text-white">
                  {new Date(rebuildStatus.completed_at).toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Processed</div>
                <div className="text-lg font-bold text-white">
                  {rebuildStatus.records_processed || 0}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Created</div>
                <div className="text-lg font-bold text-green-400">
                  {rebuildStatus.records_created || 0}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Duration</div>
                <div className="text-sm text-white">
                  {(rebuildStatus.duration_ms / 1000).toFixed(1)}s
                </div>
              </div>
            </div>

            {rebuildStatus.metadata && (
              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">Details</div>
                <div className="text-sm text-gray-300">
                  {rebuildStatus.metadata.value_epoch && (
                    <div>Epoch: {rebuildStatus.metadata.value_epoch}</div>
                  )}
                  {rebuildStatus.metadata.breakout_count !== undefined && (
                    <div>Breakouts Detected: {rebuildStatus.metadata.breakout_count}</div>
                  )}
                  {rebuildStatus.metadata.validation_failures !== undefined && (
                    <div>Validation Failures: {rebuildStatus.metadata.validation_failures}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            No rebuild has been run yet
          </div>
        )}
      </div>

      {/* Trigger Rebuild */}
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Play className="w-6 h-6 text-[#00d4ff]" />
          <h2 className="text-xl font-bold text-white">Trigger Rebuild</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-300">
                <strong>Warning:</strong> This will recalculate ALL player values using production-based scoring.
                Preseason ADP-based values will be replaced with {SEASON_CONTEXT.last_completed_season} season
                performance data. This process takes 2-5 minutes and cannot be undone.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg">
            <input
              type="checkbox"
              id="confirmRebuild"
              checked={confirmRebuild}
              onChange={(e) => setConfirmRebuild(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="confirmRebuild" className="text-sm text-gray-300 cursor-pointer">
              I understand this will replace all current player values with production-based calculations using
              {' '}{SEASON_CONTEXT.last_completed_season} season data. Players like Jaxon Smith-Njigba will be
              properly ranked based on their breakout performance.
            </label>
          </div>

          <button
            onClick={triggerRebuild}
            disabled={loading || !confirmRebuild}
            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              loading || !confirmRebuild
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#00d4ff] hover:bg-[#00b8e6] text-gray-900'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Rebuilding Values...
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5" />
                Rebuild All Player Values
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-4 p-4 rounded-lg border ${
            result.success
              ? 'bg-green-900/20 border-green-500/30'
              : 'bg-red-900/20 border-red-500/30'
          }`}>
            <div className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <div className={result.success ? 'text-green-300' : 'text-red-300'}>
                  {result.message || (result.success ? 'Rebuild initiated successfully' : 'Rebuild failed')}
                </div>
                {result.note && (
                  <div className="text-gray-400 mt-1">{result.note}</div>
                )}
                {result.instructions && (
                  <ul className="mt-2 space-y-1 text-gray-400">
                    {result.instructions.map((instruction: string, idx: number) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ul>
                )}
                {result.error && (
                  <div className="text-red-300 mt-1">Error: {result.error}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Season Rollover Status */}
      {rolloverStatus && (
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Last Season Rollover</h2>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Date</div>
                <div className="text-sm text-white">
                  {new Date(rolloverStatus.completed_at).toLocaleDateString()}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className={`text-sm font-medium ${
                  rolloverStatus.status === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {rolloverStatus.status}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Duration</div>
                <div className="text-sm text-white">
                  {(rolloverStatus.duration_ms / 1000 / 60).toFixed(1)}m
                </div>
              </div>
            </div>

            {rolloverStatus.metadata && (
              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">Transition</div>
                <div className="text-sm text-gray-300">
                  {rolloverStatus.metadata.from_season} → {rolloverStatus.metadata.to_season}
                  {' '}({rolloverStatus.metadata.from_epoch} → {rolloverStatus.metadata.to_epoch})
                </div>
                {rolloverStatus.metadata.invalidated_count && (
                  <div className="text-sm text-gray-400 mt-1">
                    Archived {rolloverStatus.metadata.invalidated_count} old values
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
