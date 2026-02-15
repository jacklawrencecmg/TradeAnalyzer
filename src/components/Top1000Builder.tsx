import { useState } from 'react';
import { Download, FileDown, CheckCircle, AlertCircle, RefreshCw, Database } from 'lucide-react';
import { buildTop1000DynastyBase, DynastyBuildResult } from '../lib/build/buildTop1000DynastyBase';
import { fillRedraftValues, RedraftFillResult, Top1000PlayerWithRedraft } from '../lib/build/fillRedraftValues';
import { exportTop1000PprCsv, exportTop1000HalfCsv, exportTop1000CombinedCsv, downloadCsv } from '../lib/export/exportTop1000Csv';
import { syncFantasyProsToDatabase, SyncResult } from '../lib/build/syncFantasyProsToDatabase';

interface BuildStatus {
  stage: 'idle' | 'dynasty' | 'redraft' | 'syncing' | 'complete' | 'error';
  message: string;
}

export default function Top1000Builder() {
  const [status, setStatus] = useState<BuildStatus>({
    stage: 'idle',
    message: 'Ready to build',
  });
  const [dynastyResult, setDynastyResult] = useState<DynastyBuildResult | null>(null);
  const [redraftResult, setRedraftResult] = useState<RedraftFillResult | null>(null);
  const [fullData, setFullData] = useState<Top1000PlayerWithRedraft[] | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const isLoading = status.stage !== 'idle' && status.stage !== 'complete' && status.stage !== 'error';

  const buildDynastyBase = async () => {
    try {
      setStatus({ stage: 'dynasty', message: 'Building dynasty base (downloading 6 sources)...' });
      setDynastyResult(null);
      setRedraftResult(null);
      setFullData(null);

      const result = await buildTop1000DynastyBase();

      if (!result.success) {
        setStatus({ stage: 'error', message: 'Dynasty build failed. See errors below.' });
        setDynastyResult(result);
        return;
      }

      setStatus({ stage: 'complete', message: `Dynasty base built: ${result.players.length} players` });
      setDynastyResult(result);
    } catch (error) {
      setStatus({ stage: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const fillRedraft = async () => {
    if (!dynastyResult || !dynastyResult.success) {
      setStatus({ stage: 'error', message: 'Build dynasty base first' });
      return;
    }

    try {
      setStatus({ stage: 'redraft', message: 'Filling redraft values (downloading 4 sources)...' });
      setRedraftResult(null);
      setFullData(null);

      const result = await fillRedraftValues(dynastyResult.players);

      if (!result.success) {
        setStatus({ stage: 'error', message: 'Redraft fill failed. See errors below.' });
        setRedraftResult(result);
        return;
      }

      setStatus({ stage: 'complete', message: `Complete: ${result.players.length} players with dual redraft values` });
      setRedraftResult(result);
      setFullData(result.players);
    } catch (error) {
      setStatus({ stage: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const syncToDatabase = async () => {
    if (!fullData || fullData.length === 0) {
      setStatus({ stage: 'error', message: 'Build and fill redraft values first' });
      return;
    }

    try {
      setStatus({ stage: 'syncing', message: 'Syncing values to database (matching with Sleeper IDs)...' });
      setSyncResult(null);

      const result = await syncFantasyProsToDatabase(fullData);

      if (!result.success) {
        setStatus({ stage: 'error', message: 'Database sync failed. See errors below.' });
        setSyncResult(result);
        return;
      }

      setStatus({ stage: 'complete', message: `Synced ${result.synced_count} players to database` });
      setSyncResult(result);
    } catch (error) {
      setStatus({ stage: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const downloadPpr = () => {
    if (!fullData) return;
    const csv = exportTop1000PprCsv(fullData);
    downloadCsv(csv, 'top1000_ppr.csv');
  };

  const downloadHalf = () => {
    if (!fullData) return;
    const csv = exportTop1000HalfCsv(fullData);
    downloadCsv(csv, 'top1000_half.csv');
  };

  const downloadCombined = () => {
    if (!fullData) return;
    const csv = exportTop1000CombinedCsv(fullData);
    downloadCsv(csv, 'top1000_combined.csv');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Download className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Top 1000 Builder</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Build Process</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Build Dynasty Base: Downloads dynasty SF + overall + 4 IDP sources (6 total)</li>
            <li>Fill Redraft Values: Downloads PPR + Half-PPR rankings and ADP (4 sources)</li>
            <li>Sync to Database: Match with Sleeper IDs and update Power Rankings + imports</li>
            <li>Export: Choose PPR, Half-PPR, or combined CSV with both flavors</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={buildDynastyBase}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {isLoading && status.stage === 'dynasty' ? 'Building...' : 'Build Dynasty+IDP Top1000'}
          </button>

          {dynastyResult && dynastyResult.success && (
            <button
              onClick={fillRedraft}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {isLoading && status.stage === 'redraft' ? 'Filling...' : 'Fill Redraft (ADP + Rankings)'}
            </button>
          )}

          {fullData && fullData.length > 0 && (
            <button
              onClick={syncToDatabase}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Database className="w-4 h-4" />
              {isLoading && status.stage === 'syncing' ? 'Syncing...' : 'Sync to Database'}
            </button>
          )}

          {fullData && fullData.length > 0 && (
            <>
              <button
                onClick={downloadPpr}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Export PPR CSV
              </button>

              <button
                onClick={downloadHalf}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Export Half CSV
              </button>

              <button
                onClick={downloadCombined}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Export Combined CSV
              </button>
            </>
          )}
        </div>

        {status.stage !== 'idle' && (
          <div
            className={`rounded-lg p-4 ${
              status.stage === 'error'
                ? 'bg-red-50 border border-red-200'
                : status.stage === 'complete'
                ? 'bg-green-50 border border-green-200'
                : 'bg-blue-50 border border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {status.stage === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {status.stage === 'complete' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {isLoading && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />}
              <p
                className={`text-sm font-medium ${
                  status.stage === 'error'
                    ? 'text-red-900'
                    : status.stage === 'complete'
                    ? 'text-green-900'
                    : 'text-blue-900'
                }`}
              >
                {status.message}
              </p>
            </div>
          </div>
        )}

        {dynastyResult && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Dynasty Base Results</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {dynastyResult.players.length}
                </div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {dynastyResult.offense_count}
                </div>
                <div className="text-sm text-gray-600">Offense</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {dynastyResult.idp_count}
                </div>
                <div className="text-sm text-gray-600">IDP</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {dynastyResult.duplicates_removed}
                </div>
                <div className="text-sm text-gray-600">Duplicates Removed</div>
              </div>
            </div>

            {dynastyResult.sources_used.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Sources Used</h4>
                <div className="flex flex-wrap gap-2">
                  {dynastyResult.sources_used.map((source) => (
                    <span
                      key={source}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {dynastyResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-red-700 cursor-pointer font-medium">
                  {dynastyResult.errors.length} errors (click to view)
                </summary>
                <ul className="mt-2 text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {dynastyResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {redraftResult && (
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 space-y-3">
            <h3 className="font-medium text-orange-900">Redraft Fill Results</h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xl font-bold text-green-600">
                  {redraftResult.ppr_matched_adp}
                </div>
                <div className="text-sm text-orange-700">PPR via ADP</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  {redraftResult.ppr_matched_rankings}
                </div>
                <div className="text-sm text-orange-700">PPR via Rankings</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">
                  {redraftResult.ppr_fallback}
                </div>
                <div className="text-sm text-orange-700">PPR Fallback</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  {redraftResult.half_matched_adp}
                </div>
                <div className="text-sm text-orange-700">Half via ADP</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  {redraftResult.half_matched_rankings}
                </div>
                <div className="text-sm text-orange-700">Half via Rankings</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">
                  {redraftResult.half_fallback}
                </div>
                <div className="text-sm text-orange-700">Half Fallback</div>
              </div>
            </div>

            {redraftResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-orange-700 cursor-pointer font-medium">
                  {redraftResult.errors.length} errors (click to view)
                </summary>
                <ul className="mt-2 text-xs text-orange-600 space-y-1 max-h-32 overflow-y-auto">
                  {redraftResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {syncResult && (
          <div className={`rounded-lg p-4 border ${
            syncResult.success
              ? 'bg-purple-50 border-purple-200'
              : 'bg-red-50 border-red-200'
          } space-y-3`}>
            <h3 className={`font-medium ${
              syncResult.success ? 'text-purple-900' : 'text-red-900'
            }`}>Database Sync Results</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {syncResult.synced_count}
                </div>
                <div className="text-sm text-gray-700">Synced to DB</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {syncResult.matched_count}
                </div>
                <div className="text-sm text-gray-700">Matched</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {syncResult.unmatched_count}
                </div>
                <div className="text-sm text-gray-700">Unmatched</div>
              </div>
            </div>

            {syncResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-red-700 cursor-pointer font-medium">
                  {syncResult.errors.length} errors (click to view)
                </summary>
                <ul className="mt-2 text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {syncResult.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="bg-purple-100 rounded p-3 mt-3">
              <p className="text-sm text-purple-900">
                <strong>✓ Power Rankings and Sleeper imports will now use these values</strong>
              </p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-sm font-medium text-blue-900 mb-1">Export Options</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>PPR CSV:</strong> One row per player with PPR redraft values</li>
            <li><strong>Half CSV:</strong> One row per player with Half-PPR redraft values</li>
            <li><strong>Combined CSV:</strong> Two rows per player (PPR + Half) = 2000 rows total</li>
          </ul>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <h3 className="text-sm font-medium text-yellow-900 mb-1">Note</h3>
          <p className="text-sm text-yellow-700">
            Full import downloads 10 CSVs total (6 dynasty/IDP + 4 redraft/ADP sources).
            This may take 60-120 seconds depending on FantasyPros server response times.
            Each source has a 1-second delay to be respectful of their servers.
          </p>
        </div>
      </div>
    </div>
  );
}
