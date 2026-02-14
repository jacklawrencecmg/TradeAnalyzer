import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Eye, AlertTriangle, Target, ArrowRight, Users } from 'lucide-react';
import WatchlistButton from './WatchlistButton';

interface ReportPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  change_7d: number;
  change_pct: number;
  value_now: number;
  value_7d_ago: number;
  trend_tag?: string;
  signal_strength?: number;
}

interface MarketNote {
  category: string;
  title: string;
  description: string;
  impact?: string;
}

interface ReportSection {
  type: string;
  title: string;
  players?: ReportPlayer[];
  notes?: MarketNote[];
}

interface DynastyReport {
  id: string;
  week: number;
  season: number;
  title: string;
  summary: string;
  content: {
    sections: ReportSection[];
  };
  public_slug: string;
  created_at: string;
  view_count: number;
  metadata: {
    top_riser_name: string;
    top_riser_change: number;
    top_faller_name: string;
    top_faller_change: number;
    total_players_analyzed: number;
    significant_movers: number;
  };
}

interface LeaguePlayer {
  player_id: string;
  player_name: string;
  section_type: string;
}

interface DynastyReportPageProps {
  slug: string;
  onBack: () => void;
  onSelectPlayer?: (playerId: string) => void;
  leaguePlayerIds?: string[];
}

export default function DynastyReportPage({ slug, onBack, onSelectPlayer, leaguePlayerIds = [] }: DynastyReportPageProps) {
  const [report, setReport] = useState<DynastyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaguePlayers, setLeaguePlayers] = useState<LeaguePlayer[]>([]);

  useEffect(() => {
    loadReport();
  }, [slug]);

  useEffect(() => {
    if (report && leaguePlayerIds.length > 0) {
      checkLeaguePlayers();
    }
  }, [report, leaguePlayerIds]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_report_by_slug`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_slug: slug }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load report');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('Report not found');
      }

      setReport(data[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const checkLeaguePlayers = async () => {
    if (!leaguePlayerIds || leaguePlayerIds.length === 0) {
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/check_user_players_in_report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_slug: slug,
            p_player_ids: leaguePlayerIds,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLeaguePlayers(data || []);
      }
    } catch (err) {
      console.error('Error checking league players:', err);
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'risers': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'fallers': return <TrendingDown className="w-5 h-5 text-red-600" />;
      case 'buy_low': return <Target className="w-5 h-5 text-blue-600" />;
      case 'sell_high': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default: return <ArrowRight className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
              <div className="h-10 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Reports
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error || 'Report not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Reports
        </button>

        {/* Report Header */}
        <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
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

            <h1 className="text-4xl font-bold text-gray-900 mb-4">{report.title}</h1>

            <p className="text-lg text-gray-700 leading-relaxed">{report.summary}</p>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-600 mb-1">Top Riser</div>
              <div className="font-bold text-green-600">
                +{report.metadata.top_riser_change.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{report.metadata.top_riser_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Top Faller</div>
              <div className="font-bold text-red-600">
                {report.metadata.top_faller_change.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">{report.metadata.top_faller_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Significant Movers</div>
              <div className="font-bold text-gray-900">
                {report.metadata.significant_movers}
              </div>
              <div className="text-xs text-gray-500">Players</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Players Analyzed</div>
              <div className="font-bold text-gray-900">
                {report.metadata.total_players_analyzed}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>
        </article>

        {/* League Players Banner */}
        {leaguePlayers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <Users className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">
                  {leaguePlayers.length} {leaguePlayers.length === 1 ? 'player' : 'players'} from your league {leaguePlayers.length === 1 ? 'appears' : 'appear'} in this report!
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {leaguePlayers.map((lp, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectPlayer?.(lp.player_id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <span className="font-semibold text-blue-900">{lp.player_name}</span>
                      <span className="text-xs text-blue-600">
                        {lp.section_type === 'risers' && '📈 Riser'}
                        {lp.section_type === 'fallers' && '📉 Faller'}
                        {lp.section_type === 'buy_low' && '💎 Buy Low'}
                        {lp.section_type === 'sell_high' && '⚠️ Sell High'}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-blue-700">
                  These players are on your roster and were featured in this week's report. Click to view details.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Report Sections */}
        <div className="space-y-6">
          {report.content.sections.map((section, idx) => (
            <section key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                {getSectionIcon(section.type)}
                <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
              </div>

              {section.players && section.players.length > 0 && (
                <div className="space-y-4">
                  {section.players.map((player, playerIdx) => (
                    <div
                      key={playerIdx}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => onSelectPlayer?.(player.player_id)}
                            className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {player.player_name}
                          </button>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getPositionColor(player.position)}`}>
                            {player.position}
                          </span>
                          {player.team && (
                            <span className="text-sm text-gray-600">{player.team}</span>
                          )}
                          <WatchlistButton playerId={player.player_id} variant="icon" />
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Current Value: </span>
                            <span className="font-semibold text-gray-900">
                              {player.value_now.toLocaleString()}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 font-semibold ${
                            player.change_7d > 0 ? 'text-green-600' : player.change_7d < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {player.change_7d > 0 ? <TrendingUp className="w-4 h-4" /> : player.change_7d < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                            <span>{player.change_7d > 0 ? '+' : ''}{player.change_7d.toLocaleString()}</span>
                            <span>({player.change_7d > 0 ? '+' : ''}{player.change_pct}%)</span>
                          </div>
                          {player.signal_strength && (
                            <div className="text-gray-600">
                              Signal: <span className="font-semibold">{player.signal_strength}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {section.notes && section.notes.length > 0 && (
                <div className="space-y-4">
                  {section.notes.map((note, noteIdx) => (
                    <div
                      key={noteIdx}
                      className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <h3 className="font-bold text-gray-900 mb-2">{note.title}</h3>
                      <p className="text-gray-700">{note.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-2">Want personalized insights?</h3>
          <p className="text-blue-100 mb-4">
            Add players to your watchlist and get alerts when their values change
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
          >
            View More Reports
          </button>
        </div>
      </div>
    </div>
  );
}
