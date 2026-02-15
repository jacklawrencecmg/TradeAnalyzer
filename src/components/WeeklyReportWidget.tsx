import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, AlertTriangle, ChevronRight } from 'lucide-react';
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
  value_change: number;
  created_at: string;
}

interface WeeklyReportWidgetProps {
  leagueId?: string;
  onViewAll?: () => void;
}

export function WeeklyReportWidget({ leagueId, onViewAll }: WeeklyReportWidgetProps) {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && leagueId) {
      loadLatestReport();
    }
  }, [user?.id, leagueId]);

  const loadLatestReport = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_team_reports')
        .select('*')
        .eq('user_id', user!.id)
        .eq('league_id', leagueId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setReport(data);
    } catch (error) {
      console.error('Error loading weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Weekly Team Report</h3>
        <p className="text-sm text-gray-600">
          Your personalized weekly report will appear here after the first week.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Week {report.week} Report
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

      <div className="bg-white rounded-lg p-4 mb-4">
        <p className="text-gray-800 leading-relaxed">{report.summary}</p>
      </div>

      {report.strengths.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">Strengths</span>
          </div>
          <ul className="space-y-1">
            {report.strengths.slice(0, 2).map((strength, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>{strength.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.weaknesses.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-semibold text-gray-900">Areas to Improve</span>
          </div>
          <ul className="space-y-1">
            {report.weaknesses.slice(0, 2).map((weakness, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>{weakness.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.recommended_moves.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm font-semibold text-gray-900 mb-2">Recommended Action</div>
          <p className="text-sm text-gray-700">{report.recommended_moves[0].action}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <QuickReaction
          contentType="advice"
          contentId={report.id}
          metadata={{ reportWeek: report.week }}
          className="scale-90"
        />
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All Reports
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
