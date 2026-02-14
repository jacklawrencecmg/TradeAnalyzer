import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Play,
  Shield,
  Clock,
  Zap,
  Database,
  FileText
} from 'lucide-react';

interface DoctorFinding {
  id: string;
  severity: 'critical' | 'warning' | 'pass';
  title: string;
  details: string;
  fix_available: boolean;
  metadata?: Record<string, any>;
}

interface AuditResult {
  ok: boolean;
  summary: {
    critical: number;
    warning: number;
    passed: number;
  };
  findings: DoctorFinding[];
  timestamp: string;
}

interface RepairResult {
  success: boolean;
  fixes_applied: Array<{
    fix_id: string;
    description: string;
    rows_affected: number;
    success: boolean;
    error?: string;
  }>;
  total_fixes: number;
  timestamp: string;
}

interface SafeModeState {
  enabled: boolean;
  reason: string | null;
  critical_issues: any[];
}

export default function DoctorAdmin() {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [safeMode, setSafeMode] = useState<SafeModeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isAuthorized) {
      checkSafeMode();
    }
  }, [isAuthorized]);

  const checkSafeMode = async () => {
    try {
      const { data, error } = await fetch('/api/safe-mode').then(r => r.json());
      if (!error && data) {
        setSafeMode(data);
      }
    } catch (err) {
      console.error('Failed to check safe mode:', err);
    }
  };

  const runAudit = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/doctor-audit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Audit failed: ' + response.statusText);
      }

      const result = await response.json();
      setAuditResult(result);
      setRepairResult(null);
      await checkSafeMode();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  };

  const runRepair = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/doctor-repair`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Repair failed: ' + response.statusText);
      }

      const result = await response.json();
      setRepairResult(result);

      // Run audit again to see improvements
      await runAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run repair');
    } finally {
      setLoading(false);
    }
  };

  const authorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminSecret) {
      setIsAuthorized(true);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex items-center justify-center mb-6">
            <Shield className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Doctor Admin
          </h1>
          <p className="text-gray-400 text-center mb-6">
            Enter ADMIN_SYNC_SECRET to access
          </p>
          <form onSubmit={authorize}>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="ADMIN_SYNC_SECRET"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Authorize
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Doctor Admin</h1>
          </div>
          <p className="text-gray-400">
            Audit and repair system to ensure data consistency across the platform
          </p>
        </div>

        {/* Safe Mode Banner */}
        {safeMode?.enabled && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-red-400">Safe Mode Enabled</div>
                <div className="text-sm text-red-300">{safeMode.reason}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={runAudit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            <Play className="w-5 h-5" />
            {loading ? 'Running...' : 'Run Full Audit'}
          </button>
          <button
            onClick={runRepair}
            disabled={loading || !auditResult}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            <Wrench className="w-5 h-5" />
            {loading ? 'Repairing...' : 'Auto-Repair Issues'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Audit Results */}
        {auditResult && (
          <div className="mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-6 h-6" />
                  Audit Results
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  {new Date(auditResult.timestamp).toLocaleString()}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        {auditResult.summary.passed}
                      </div>
                      <div className="text-sm text-gray-400">Passed</div>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {auditResult.summary.warning}
                      </div>
                      <div className="text-sm text-gray-400">Warnings</div>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-red-400">
                        {auditResult.summary.critical}
                      </div>
                      <div className="text-sm text-gray-400">Critical</div>
                    </div>
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white mb-3">Findings</h3>
                {auditResult.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className={`p-4 rounded-lg border ${
                      finding.severity === 'critical'
                        ? 'bg-red-900/20 border-red-500/50'
                        : finding.severity === 'warning'
                        ? 'bg-yellow-900/20 border-yellow-500/50'
                        : 'bg-green-900/20 border-green-500/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {finding.severity === 'critical' ? (
                        <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      ) : finding.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-white">{finding.title}</div>
                          {finding.fix_available && (
                            <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                              Auto-Fixable
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300">{finding.details}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Repair Results */}
        {repairResult && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-6 h-6" />
                Repair Results
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                {new Date(repairResult.timestamp).toLocaleString()}
              </div>
            </div>

            <div className={`mb-6 p-4 rounded-lg border ${
              repairResult.success
                ? 'bg-green-900/20 border-green-500/50'
                : 'bg-yellow-900/20 border-yellow-500/50'
            }`}>
              <div className="flex items-center gap-2">
                {repairResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
                <span className="text-white font-medium">
                  {repairResult.success
                    ? `Successfully applied ${repairResult.total_fixes} fixes`
                    : `Applied ${repairResult.total_fixes} fixes, but some issues remain`}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white mb-3">Fixes Applied</h3>
              {repairResult.fixes_applied.map((fix, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    fix.success
                      ? 'bg-green-900/20 border-green-500/50'
                      : 'bg-red-900/20 border-red-500/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {fix.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-1">{fix.description}</div>
                      <div className="text-sm text-gray-300">
                        {fix.success
                          ? `${fix.rows_affected} rows affected`
                          : `Failed: ${fix.error}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Panel */}
        {!auditResult && !loading && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <FileText className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  About Doctor System
                </h3>
                <p className="text-gray-300 mb-4">
                  The Doctor audit system performs comprehensive checks to ensure data consistency
                  across your entire platform. It checks:
                </p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>✓ Canonical source enforcement (all tables use player_id)</li>
                  <li>✓ Latest values consistency (no duplicate or stale data)</li>
                  <li>✓ Format and position validation (canonical enums)</li>
                  <li>✓ Snapshot integrity (no missing fields or orphans)</li>
                  <li>✓ Cache drift prevention</li>
                  <li>✓ Resolver and aliases health</li>
                  <li>✓ Team history correctness</li>
                  <li>✓ Coverage by position (minimum thresholds)</li>
                  <li>✓ Sync pipeline correctness</li>
                  <li>✓ Cross-endpoint value equality</li>
                </ul>
                <p className="text-gray-300 mt-4">
                  Click "Run Full Audit" to begin. If issues are found, click "Auto-Repair Issues"
                  to automatically fix them.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
