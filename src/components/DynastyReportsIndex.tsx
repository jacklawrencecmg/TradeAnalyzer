import { useState, useEffect } from 'react';
import { FileText, Calendar, Eye, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface ReportSummary {
  id: string;
  week: number;
  season: number;
  title: string;
  summary: string;
  public_slug: string;
  created_at: string;
  view_count: number;
  top_riser_name: string;
  top_faller_name: string;
}

interface DynastyReportsIndexProps {
  onSelectReport: (slug: string) => void;
}

export default function DynastyReportsIndex({ onSelectReport }: DynastyReportsIndexProps) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/list_published_reports`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_limit: 50, p_offset: 0 }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load reports');
      }

      const data = await response.json();
      setReports(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Dynasty Market Reports</h1>
          </div>
          <p className="text-lg text-gray-600">
            Weekly analysis of the biggest value changes and market trends in dynasty fantasy football
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 mb-2">No Reports Yet</h3>
            <p className="text-gray-500">
              Weekly dynasty market reports will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <article
                key={report.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => onSelectReport(report.public_slug)}
                  className="w-full p-6 text-left"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Week {report.week}, {report.season}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{report.view_count.toLocaleString()} views</span>
                        </div>
                        <span>•</span>
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>

                      <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
                        {report.title}
                      </h2>

                      <p className="text-gray-700 leading-relaxed mb-4">
                        {report.summary}
                      </p>

                      {/* Key Movers Preview */}
                      {(report.top_riser_name || report.top_faller_name) && (
                        <div className="flex items-center gap-6 text-sm">
                          {report.top_riser_name && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-gray-600">Top Riser:</span>
                              <span className="font-semibold text-gray-900">
                                {report.top_riser_name}
                              </span>
                            </div>
                          )}
                          {report.top_faller_name && (
                            <div className="flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-red-600" />
                              <span className="text-gray-600">Top Faller:</span>
                              <span className="font-semibold text-gray-900">
                                {report.top_faller_name}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0 mt-2" />
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {reports.length > 0 && (
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-white text-center">
            <h3 className="text-2xl font-bold mb-2">Stay Ahead of the Market</h3>
            <p className="text-blue-100 mb-4">
              Get personalized alerts when your watchlist players appear in weekly reports
            </p>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
              Add Players to Watchlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
