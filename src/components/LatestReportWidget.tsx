import { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, ArrowRight, Calendar } from 'lucide-react';

interface LatestReport {
  id: string;
  week: number;
  season: number;
  title: string;
  summary: string;
  public_slug: string;
  created_at: string;
  view_count: number;
}

interface LatestReportWidgetProps {
  onSelectReport: (slug: string) => void;
}

export default function LatestReportWidget({ onSelectReport }: LatestReportWidgetProps) {
  const [report, setReport] = useState<LatestReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLatestReport();
  }, []);

  const loadLatestReport = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_latest_report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load latest report');
      }

      const data = await response.json();

      if (data && data.length > 0) {
        setReport(data[0]);
      }
    } catch (err) {
      console.error('Error loading latest report:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 text-white">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5" />
          <h3 className="text-lg font-bold">This Week's Market Report</h3>
        </div>

        <button
          onClick={() => onSelectReport(report.public_slug)}
          className="w-full text-left group"
        >
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm text-blue-100 mb-2">
              <Calendar className="w-4 h-4" />
              <span>Week {report.week}, {report.season}</span>
              <span>•</span>
              <span>{new Date(report.created_at).toLocaleDateString()}</span>
            </div>

            <h4 className="text-xl font-bold mb-2 group-hover:text-blue-100 transition-colors">
              {report.title}
            </h4>

            <p className="text-blue-50 leading-relaxed line-clamp-2">
              {report.summary}
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-blue-400">
            <span className="text-sm text-blue-100">
              {report.view_count.toLocaleString()} views
            </span>
            <div className="flex items-center gap-2 text-sm font-semibold group-hover:gap-3 transition-all">
              <span>Read Full Report</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
