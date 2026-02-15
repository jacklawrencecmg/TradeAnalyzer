import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, FileText, Database, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DoctorFinding {
  id: string;
  severity: 'critical' | 'warning' | 'pass';
  title: string;
  details: string;
  fix_available: boolean;
  metadata?: Record<string, any>;
}

interface DoctorReport {
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
  before: DoctorReport;
  after: DoctorReport;
  fixes_applied: Array<{
    fix_id: string;
    description: string;
    rows_affected: number;
    success: boolean;
    error?: string;
  }>;
  timestamp: string;
}

export default function DoctorDashboard() {
  const [isScanning, setIsScanning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const { data, error: scanError } = await supabase.functions.invoke(
        'doctor-audit',
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_ADMIN_SYNC_SECRET}`,
          },
        }
      );

      if (scanError) throw scanError;

      setReport(data);
      setRepairResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const runRepair = async () => {
    setIsRepairing(true);
    setError(null);

    try {
      const { data, error: repairError } = await supabase.functions.invoke(
        'doctor-repair',
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_ADMIN_SYNC_SECRET}`,
          },
        }
      );

      if (repairError) throw repairError;

      setRepairResult(data);
      setReport(data.after);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setIsRepairing(false);
    }
  };

  const exportReport = () => {
    if (!report) return;

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctor-report-${report.timestamp}.json`;
    a.click();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'pass':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Doctor</h1>
          <p className="text-gray-600 mt-1">
            Auto-detect and repair value bugs, cache issues, and data inconsistencies
          </p>
        </div>
        <Activity className="w-8 h-8 text-blue-600" />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={runScan}
          disabled={isScanning || isRepairing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Activity className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Scan System'}
        </button>

        <button
          onClick={runRepair}
          disabled={!report || isRepairing || report.summary.critical === 0}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Zap className={`w-5 h-5 ${isRepairing ? 'animate-pulse' : ''}`} />
          {isRepairing ? 'Repairing...' : 'Repair Safe Issues'}
        </button>

        <button
          onClick={exportReport}
          disabled={!report}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FileText className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-900">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {report.ok ? 'Healthy' : 'Issues'}
                </p>
              </div>
              {report.ok ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Critical</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {report.summary.critical}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Warnings</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">
                  {report.summary.warning}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Passed</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {report.summary.passed}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Repair Result */}
      {repairResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-green-600" />
            Repair Results
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Before</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-red-600 font-medium">
                    {repairResult.before.summary.critical} critical
                  </span>
                  <span className="text-yellow-600 font-medium">
                    {repairResult.before.summary.warning} warnings
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">After</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-red-600 font-medium">
                    {repairResult.after.summary.critical} critical
                  </span>
                  <span className="text-yellow-600 font-medium">
                    {repairResult.after.summary.warning} warnings
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Fixes Applied</p>
              <div className="space-y-2">
                {repairResult.fixes_applied.map((fix, index) => (
                  <div
                    key={index}
                    className={`border rounded p-3 ${
                      fix.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{fix.description}</span>
                      {fix.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {fix.rows_affected} rows affected
                    </p>
                    {fix.error && (
                      <p className="text-sm text-red-600 mt-1">{fix.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      {report && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Findings</h2>

          <div className="space-y-3">
            {/* Critical Issues */}
            {report.findings.filter((f) => f.severity === 'critical').length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-2">Critical Issues</h3>
                {report.findings
                  .filter((f) => f.severity === 'critical')
                  .map((finding) => (
                    <div
                      key={finding.id}
                      className={`border rounded-lg p-4 ${getSeverityColor(finding.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getSeverityIcon(finding.severity)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{finding.title}</h4>
                            <p className="text-sm text-gray-700 mt-1">{finding.details}</p>
                            {finding.metadata && (
                              <details className="mt-2">
                                <summary className="text-sm text-gray-600 cursor-pointer">
                                  View Details
                                </summary>
                                <pre className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border overflow-auto">
                                  {JSON.stringify(finding.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                        {finding.fix_available && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            Auto-fixable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Warnings */}
            {report.findings.filter((f) => f.severity === 'warning').length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Warnings</h3>
                {report.findings
                  .filter((f) => f.severity === 'warning')
                  .map((finding) => (
                    <div
                      key={finding.id}
                      className={`border rounded-lg p-4 ${getSeverityColor(finding.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {getSeverityIcon(finding.severity)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{finding.title}</h4>
                            <p className="text-sm text-gray-700 mt-1">{finding.details}</p>
                          </div>
                        </div>
                        {finding.fix_available && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            Auto-fixable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Passed Checks */}
            {report.findings.filter((f) => f.severity === 'pass').length > 0 && (
              <details className="mt-4">
                <summary className="text-lg font-semibold text-green-900 cursor-pointer">
                  Passed Checks ({report.findings.filter((f) => f.severity === 'pass').length})
                </summary>
                <div className="mt-2 space-y-2">
                  {report.findings
                    .filter((f) => f.severity === 'pass')
                    .map((finding) => (
                      <div
                        key={finding.id}
                        className={`border rounded-lg p-3 ${getSeverityColor(finding.severity)}`}
                      >
                        <div className="flex items-center gap-3">
                          {getSeverityIcon(finding.severity)}
                          <div>
                            <h4 className="font-medium text-gray-900">{finding.title}</h4>
                            <p className="text-sm text-gray-600">{finding.details}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !isScanning && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scan Results</h3>
          <p className="text-gray-600 mb-6">
            Run a system scan to detect value bugs, cache issues, and data inconsistencies
          </p>
          <button
            onClick={runScan}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run First Scan
          </button>
        </div>
      )}
    </div>
  );
}
