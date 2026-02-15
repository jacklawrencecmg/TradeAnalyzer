import { useState } from 'react';
import { Download, CheckCircle, AlertCircle, BarChart3, FileDown } from 'lucide-react';
import { buildTop1000FromFantasyPros, syncTop1000ToPlayerValues } from '../lib/build/buildTop1000FromFantasyPros';

interface ImportStatus {
  stage: 'idle' | 'downloading' | 'processing' | 'saving' | 'complete' | 'error';
  message: string;
  progress?: number;
}

export default function FantasyProsImport() {
  const [status, setStatus] = useState<ImportStatus>({
    stage: 'idle',
    message: 'Ready to import',
  });
  const [result, setResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const runImport = async () => {
    try {
      setStatus({ stage: 'downloading', message: 'Downloading CSVs from FantasyPros...' });
      setResult(null);
      setSyncResult(null);

      const buildResult = await buildTop1000FromFantasyPros();

      if (!buildResult.success) {
        setStatus({
          stage: 'error',
          message: 'Import failed. See errors below.',
        });
        setResult(buildResult);
        return;
      }

      setStatus({
        stage: 'complete',
        message: `Successfully imported ${buildResult.total_players} players!`,
      });
      setResult(buildResult);
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const runSync = async () => {
    try {
      setStatus({ stage: 'saving', message: 'Syncing to player_values table...' });

      const syncRes = await syncTop1000ToPlayerValues();

      setStatus({
        stage: 'complete',
        message: `Synced ${syncRes.synced} players to database`,
      });
      setSyncResult(syncRes);
    } catch (error) {
      setStatus({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Sync error',
      });
    }
  };

  const downloadCsv = () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-top1000-csv`;
    window.open(url, '_blank');
  };

  const isLoading = ['downloading', 'processing', 'saving'].includes(status.stage);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">FantasyPros Import</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Downloads rankings from FantasyPros (Dynasty Overall, SF, IDP, DL, LB, DB)</li>
            <li>Normalizes player names, teams, and positions</li>
            <li>Merges offense and IDP into unified Top 1000</li>
            <li>Converts ranks to dynasty values using exponential curve</li>
            <li>Exports as CSV or syncs to database</li>
          </ol>
        </div>

        <div className="flex gap-3">
          <button
            onClick={runImport}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {isLoading ? 'Importing...' : 'Build Top 1000 from FantasyPros'}
          </button>

          {result && result.success && (
            <>
              <button
                onClick={runSync}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Sync to Database
              </button>

              <button
                onClick={downloadCsv}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Download CSV
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
            <div className="flex items-start gap-3">
              {status.stage === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : status.stage === 'complete' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
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
          </div>
        )}

        {result && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Import Results</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {result.total_players}
                </div>
                <div className="text-sm text-gray-600">Total Players</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {result.offense_players}
                </div>
                <div className="text-sm text-gray-600">Offense</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {result.idp_players}
                </div>
                <div className="text-sm text-gray-600">IDP</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {result.duplicates_removed}
                </div>
                <div className="text-sm text-gray-600">Duplicates Removed</div>
              </div>
            </div>

            {Object.keys(result.lists_processed).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Lists Processed</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(result.lists_processed).map(([list, count]) => (
                    <div
                      key={list}
                      className="flex justify-between bg-white rounded px-3 py-2 border border-gray-200"
                    >
                      <span className="text-gray-600 capitalize">
                        {list.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-gray-900">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-2">
                  Errors ({result.errors.length})
                </h4>
                <div className="bg-white rounded border border-red-200 p-3 max-h-40 overflow-y-auto">
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.errors.slice(0, 10).map((error: string, idx: number) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-red-400">
                        ... and {result.errors.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {syncResult && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="font-medium text-green-900 mb-2">Sync Results</h3>
            <p className="text-sm text-green-700">
              Synced {syncResult.synced} players to player_values table
            </p>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-green-700 cursor-pointer">
                  {syncResult.errors.length} errors (click to view)
                </summary>
                <ul className="mt-2 text-xs text-green-600 space-y-1 max-h-32 overflow-y-auto">
                  {syncResult.errors.slice(0, 20).map((error: string, idx: number) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <h3 className="text-sm font-medium text-yellow-900 mb-1">Note</h3>
          <p className="text-sm text-yellow-700">
            This downloads public rankings from FantasyPros. For best results, ensure you
            have a stable internet connection. The import may take 30-60 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
