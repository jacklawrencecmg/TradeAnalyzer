import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, Target, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { QuickReaction } from './QuickReaction';

interface WeeklyReport {
  id: string;
  week: number;
  season: number;
  summary: string;
  strengths: any[];
  weaknesses: any[];
  recommended_moves: any[];
  missed_moves: any[];
  value_change: number;
  created_at: string;
}

interface TeamReportsHistoryProps {
  leagueId: string;
  onBack?: () => void;
}

export function TeamReportsHistory({ leagueId, onBack }: TeamReportsHistoryProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    if (user?.id && leagueId) {
      loadReports();
    }
  }, [user?.id, leagueId]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_team_reports')
        .select('*')
        .eq('user_id', user!.id)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Reports
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Week {selectedReport.week} Report
              </h2>
              <p className="text-gray-600">
                {new Date(selectedReport.created_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              selectedReport.value_change > 0
                ? 'bg-green-100 text-green-700'
                : selectedReport.value_change < 0
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {selectedReport.value_change > 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : selectedReport.value_change < 0 ? (
                <TrendingDown className="w-5 h-5" />
              ) : null}
              <span className="font-semibold">
                {selectedReport.value_change > 0 ? '+' : ''}{Math.round(selectedReport.value_change)}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary</h3>
            <p className="text-gray-800 leading-relaxed">{selectedReport.summary}</p>
          </div>

          {selectedReport.strengths.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Strengths</h3>
              </div>
              <ul className="space-y-3">
                {selectedReport.strengths.map((strength, idx) => (
                  <li key={idx} className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-2">{strength.position}</div>
                    <p className="text-sm text-gray-700 mb-2">{strength.reason}</p>
                    {strength.players && (
                      <div className="text-xs text-gray-600">
                        Key players: {strength.players.join(', ')}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedReport.weaknesses.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-gray-900">Areas to Improve</h3>
              </div>
              <ul className="space-y-3">
                {selectedReport.weaknesses.map((weakness, idx) => (
                  <li key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-2">{weakness.position}</div>
                    <p className="text-sm text-gray-700 mb-2">{weakness.reason}</p>
                    {weakness.suggestion && (
                      <p className="text-sm text-orange-700 font-medium">{weakness.suggestion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedReport.recommended_moves.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Recommended Moves</h3>
              <div className="space-y-3">
                {selectedReport.recommended_moves.map((move, idx) => (
                  <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-600 uppercase px-2 py-1 bg-blue-100 rounded">
                        {move.priority || 'normal'}
                      </span>
                      <span className="text-xs text-gray-600">{move.type}</span>
                    </div>
                    <p className="text-sm text-gray-900">{move.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedReport.missed_moves.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Missed Opportunities</h3>
              <div className="space-y-3">
                {selectedReport.missed_moves.map((missed, idx) => (
                  <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-900">{missed.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <QuickReaction
              contentType="advice"
              contentId={selectedReport.id}
              metadata={{ reportWeek: selectedReport.week }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Reports</h1>
          <p className="text-gray-600">Your weekly team analysis and recommendations</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports Yet</h3>
          <p className="text-gray-600">
            Weekly reports will appear here after the season starts
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Week {report.week}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                  report.value_change > 0
                    ? 'bg-green-100 text-green-700'
                    : report.value_change < 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {report.value_change > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : report.value_change < 0 ? (
                    <TrendingDown className="w-4 h-4" />
                  ) : null}
                  <span className="text-sm font-semibold">
                    {report.value_change > 0 ? '+' : ''}{Math.round(report.value_change)}
                  </span>
                </div>
              </div>

              <p className="text-gray-700 mb-4 line-clamp-2">{report.summary}</p>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                {report.strengths.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4 text-green-600" />
                    {report.strengths.length} strength{report.strengths.length !== 1 ? 's' : ''}
                  </span>
                )}
                {report.weaknesses.length > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    {report.weaknesses.length} area{report.weaknesses.length !== 1 ? 's' : ''} to improve
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
