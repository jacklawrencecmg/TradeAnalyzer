import React, { useState } from 'react';
import { RefreshCw, Shield, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

interface SyncResult {
  ok: boolean;
  count?: number;
  total?: number;
  minRank?: number;
  maxRank?: number;
  timestamp?: string;
  blocked?: boolean;
  error?: string;
  reason?: string;
}

export default function KTCAdminSync() {
  const [adminToken, setAdminToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleSync = async () => {
    if (!adminToken.trim()) {
      setResult({ ok: false, error: 'Admin token is required' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-ktc-qbs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.status === 429) {
        setResult({ ok: false, blocked: true, error: 'KTC blocked the request. Try again later.' });
      } else if (!response.ok) {
        setResult({ ok: false, error: data.error || 'Sync failed' });
      } else {
        setResult(data);
        if (data.timestamp) {
          setLastSyncTime(data.timestamp);
        }
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">KTC Admin Sync</h2>
      </div>

      <div className="space-y-4">
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
            disabled={loading}
          />
          <p className="mt-1 text-xs text-gray-500">
            This token is stored only in memory and never persisted locally.
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={loading || !adminToken.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Sync KTC QBs
            </>
          )}
        </button>

        {result && (
          <div
            className={`p-4 rounded-lg border ${
              result.ok
                ? 'bg-green-50 border-green-200'
                : result.blocked
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                {result.ok ? (
                  <div>
                    <p className="font-semibold text-green-900">Sync Successful</p>
                    <p className="text-sm text-green-700 mt-1">
                      Successfully synced {result.count} of {result.total} QB values from KTC
                    </p>
                    {result.maxRank !== undefined && (
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-green-800">
                          <TrendingUp className="w-4 h-4 inline mr-1" />
                          QB{result.minRank || 1} - QB{result.maxRank}
                        </span>
                      </div>
                    )}
                  </div>
                ) : result.blocked ? (
                  <div>
                    <p className="font-semibold text-yellow-900">Request Blocked</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      KTC blocked the request. Please try again later or use a different IP.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-red-900">Sync Failed</p>
                    <p className="text-sm text-red-700 mt-1">{result.error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {result && result.ok && result.maxRank && result.maxRank < 120 && (
          <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900">Low QB Count Warning</p>
              <p className="text-sm text-orange-700 mt-1">
                Only {result.maxRank} QBs were captured. Expected at least 120 QBs for full coverage.
              </p>
            </div>
          </div>
        )}

        {lastSyncTime && (
          <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
            <Clock className="w-4 h-4" />
            <span>Last synced: {new Date(lastSyncTime).toLocaleString()}</span>
          </div>
        )}

        <div className="border-t pt-4 mt-6">
          <h3 className="font-semibold text-gray-900 mb-2">How it works:</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Fetches the latest QB rankings from KeepTradeCut</li>
            <li>Updates player values in the database</li>
            <li>Creates historical snapshots for trend analysis</li>
            <li>Supports dynasty superflex format</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
