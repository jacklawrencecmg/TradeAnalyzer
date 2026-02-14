import React, { useState } from 'react';
import { RefreshCw, Shield, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface SyncResult {
  ok: boolean;
  position?: string;
  count?: number;
  total?: number;
  minRank?: number;
  maxRank?: number;
  timestamp?: string;
  captured_at?: string;
  format?: string;
  blocked?: boolean;
  error?: string;
  reason?: string;
}

interface PositionSync {
  position: string;
  endpoint: string;
  minExpected: number;
  icon: string;
}

const POSITIONS: PositionSync[] = [
  { position: 'QB', endpoint: 'sync-ktc-qbs', minExpected: 120, icon: '🎯' },
  { position: 'RB', endpoint: 'sync-ktc-rbs', minExpected: 80, icon: '⚡' },
  { position: 'WR', endpoint: 'sync-ktc-wrs', minExpected: 100, icon: '🚀' },
  { position: 'TE', endpoint: 'sync-ktc-tes', minExpected: 50, icon: '🏈' },
];

const FORMAT_OPTIONS = [
  { value: 'dynasty-superflex', label: 'Superflex (SF)' },
  { value: 'dynasty-1qb', label: '1QB' },
  { value: 'dynasty-tep', label: 'TE Premium (TEP)' },
];

export default function KTCMultiPositionSync() {
  const [adminToken, setAdminToken] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('dynasty-superflex');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, SyncResult>>({});
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSync = async (positionSync: PositionSync) => {
    if (!adminToken.trim()) {
      setResults((prev) => ({
        ...prev,
        [positionSync.position]: { ok: false, error: 'Admin token is required' },
      }));
      return;
    }

    setLoading((prev) => ({ ...prev, [positionSync.position]: true }));
    setResults((prev) => ({ ...prev, [positionSync.position]: undefined as any }));

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${positionSync.endpoint}?format=${selectedFormat}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (response.status === 429) {
        setResults((prev) => ({
          ...prev,
          [positionSync.position]: {
            ok: false,
            blocked: true,
            error: 'KTC blocked the request. Try again later.',
          },
        }));
      } else if (!response.ok) {
        setResults((prev) => ({
          ...prev,
          [positionSync.position]: { ok: false, error: data.error || 'Sync failed' },
        }));
      } else {
        setResults((prev) => ({
          ...prev,
          [positionSync.position]: data,
        }));
      }
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [positionSync.position]: {
          ok: false,
          error: error instanceof Error ? error.message : 'Network error',
        },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [positionSync.position]: false }));
    }
  };

  const handleSyncAll = async () => {
    if (!adminToken.trim()) {
      alert('Admin token is required');
      return;
    }

    setSyncingAll(true);
    for (const positionSync of POSITIONS) {
      await handleSync(positionSync);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    setSyncingAll(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">KTC Multi-Position Sync</h2>
          <p className="text-sm text-gray-600">Sync QB, RB, WR, and TE dynasty rankings</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="adminToken" className="block text-sm font-medium text-gray-700 mb-2">
              Admin Token
            </label>
            <input
              id="adminToken"
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Enter admin sync secret"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={syncingAll}
            />
          </div>

          <div>
            <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-2">
              Dynasty Format
            </label>
            <select
              id="format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              disabled={syncingAll}
            >
              {FORMAT_OPTIONS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSyncAll}
          disabled={syncingAll || !adminToken.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {syncingAll ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Syncing All Positions...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Sync All Positions
            </>
          )}
        </button>

        <div className="grid md:grid-cols-2 gap-4">
          {POSITIONS.map((positionSync) => {
            const result = results[positionSync.position];
            const isLoading = loading[positionSync.position];

            return (
              <div key={positionSync.position} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{positionSync.icon}</span>
                    <h3 className="text-lg font-bold text-gray-900">{positionSync.position}</h3>
                  </div>
                  <button
                    onClick={() => handleSync(positionSync)}
                    disabled={isLoading || syncingAll || !adminToken.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Sync'
                    )}
                  </button>
                </div>

                {result && (
                  <div
                    className={`p-3 rounded-lg border text-sm ${
                      result.ok
                        ? 'bg-green-50 border-green-200'
                        : result.blocked
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.ok ? (
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {result.ok ? (
                          <div>
                            <p className="font-semibold text-green-900">Synced {result.count} players</p>
                            <div className="flex items-center gap-2 mt-1 text-green-700">
                              <TrendingUp className="w-3 h-3" />
                              <span>
                                {positionSync.position}
                                {result.minRank || 1}-{positionSync.position}
                                {result.maxRank}
                              </span>
                            </div>
                            {result.maxRank && result.maxRank < positionSync.minExpected && (
                              <div className="flex items-center gap-1 mt-1 text-orange-600">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="text-xs">Low count warning</span>
                              </div>
                            )}
                          </div>
                        ) : result.blocked ? (
                          <p className="text-yellow-700">KTC blocked the request</p>
                        ) : (
                          <p className="text-red-700">{result.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!result && !isLoading && (
                  <p className="text-sm text-gray-500">Ready to sync</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t pt-4 mt-6">
          <h3 className="font-semibold text-gray-900 mb-2">How it works:</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Fetches the latest rankings from KeepTradeCut for each position</li>
            <li>Supports Superflex, 1QB, and TE Premium formats</li>
            <li>Updates player values and creates historical snapshots</li>
            <li>Sync all positions at once or individually</li>
            <li>Validates data quality before saving</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
