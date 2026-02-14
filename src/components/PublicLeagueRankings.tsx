import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Calendar, Eye, Share2, Copy, Check, Users, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PublicLeagueRankingsProps {
  slug: string;
}

interface League {
  id: string;
  name: string;
  season: number;
  format: string;
  public_slug: string;
  last_sync_at: string;
}

interface TeamRanking {
  id: string;
  roster_id: number;
  team_name: string;
  owner_name: string;
  owner_avatar: string | null;
  offense_value: number;
  idp_value: number;
  total_value: number;
  rank: number;
  rank_change: number | null;
  player_count: number;
  top_player_name: string | null;
  top_player_value: number | null;
  week: number;
  created_at: string;
}

export default function PublicLeagueRankings({ slug }: PublicLeagueRankingsProps) {
  const [league, setLeague] = useState<League | null>(null);
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(0);

  useEffect(() => {
    fetchLeagueRankings();
  }, [slug]);

  useEffect(() => {
    if (league && rankings.length > 0) {
      updateMetaTags();
    }
  }, [league, rankings]);

  const fetchLeagueRankings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('public_slug', slug)
        .eq('is_public', true)
        .maybeSingle();

      if (leagueError || !leagueData) {
        throw new Error('League not found or not public');
      }

      setLeague(leagueData);

      const { data: rankingsData, error: rankingsError } = await supabase
        .from('league_rankings')
        .select('*')
        .eq('league_id', leagueData.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (rankingsError) {
        throw new Error('Failed to load rankings');
      }

      if (rankingsData && rankingsData.length > 0) {
        const latestWeek = Math.max(...rankingsData.map(r => r.week));
        setCurrentWeek(latestWeek);

        const latestRankings = rankingsData
          .filter(r => r.week === latestWeek)
          .sort((a, b) => a.rank - b.rank);

        setRankings(latestRankings);
      }
    } catch (err) {
      console.error('Error fetching league rankings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
    } finally {
      setLoading(false);
    }
  };

  const updateMetaTags = () => {
    if (!league || rankings.length === 0) return;

    const title = `${league.name} - Week ${currentWeek} Power Rankings`;
    const topTeam = rankings[0];
    const description = `${topTeam.owner_name} leads with ${topTeam.total_value.toLocaleString()} FDP value. See who's dominating your fantasy league!`;
    const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/league-og-image/${slug}`;
    const url = window.location.href;

    document.title = title;

    updateMetaTag('description', description);
    updateMetaTag('og:title', title, 'property');
    updateMetaTag('og:description', description, 'property');
    updateMetaTag('og:image', ogImageUrl, 'property');
    updateMetaTag('og:url', url, 'property');
    updateMetaTag('og:type', 'website', 'property');
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImageUrl);
  };

  const updateMetaTag = (name: string, content: string, attributeName: string = 'name') => {
    let element = document.querySelector(`meta[${attributeName}="${name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attributeName, name);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getRankChangeIcon = (rankChange: number | null) => {
    if (rankChange === null) return <Minus className="w-4 h-4 text-gray-400" />;
    if (rankChange > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (rankChange < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getRankChangeText = (rankChange: number | null) => {
    if (rankChange === null) return '—';
    if (rankChange > 0) return `+${rankChange}`;
    if (rankChange < 0) return rankChange.toString();
    return '—';
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading league rankings...</div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">League Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This league may be private or does not exist.'}</p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Week {currentWeek} • {league.season}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{league.format.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {league.last_sync_at && (
            <div className="text-sm text-gray-500">
              Last updated: {formatDate(league.last_sync_at)}
            </div>
          )}
        </div>

        {rankings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Rankings Yet</h2>
            <p className="text-gray-600">Rankings will be calculated soon. Check back later!</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {rankings.slice(0, 3).map((team, idx) => (
                <div
                  key={team.id}
                  className={`bg-white rounded-lg shadow-xl p-6 text-center transform transition-all hover:scale-105 ${
                    idx === 0 ? 'md:col-start-2 order-first md:order-none' : ''
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${getRankBadgeClass(team.rank)} mb-3 text-2xl font-bold`}>
                    {team.rank === 1 && <Crown className="w-8 h-8" />}
                    {team.rank !== 1 && team.rank}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{team.owner_name}</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">{team.total_value.toLocaleString()}</div>
                  {team.rank_change !== null && (
                    <div className="flex items-center justify-center gap-1 text-sm">
                      {getRankChangeIcon(team.rank_change)}
                      <span className={team.rank_change > 0 ? 'text-green-600' : team.rank_change < 0 ? 'text-red-600' : 'text-gray-500'}>
                        {getRankChangeText(team.rank_change)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Full Rankings Table */}
            <div className="bg-white rounded-lg shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Team</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Offense</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">IDP</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Value</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rankings.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${getRankBadgeClass(team.rank)} text-lg font-bold`}>
                            {team.rank}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {team.owner_avatar && (
                              <img
                                src={`https://sleepercdn.com/avatars/thumbs/${team.owner_avatar}`}
                                alt={team.owner_name}
                                className="w-10 h-10 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <div className="font-semibold text-gray-900">{team.owner_name}</div>
                              {team.top_player_name && (
                                <div className="text-sm text-gray-600">
                                  Top: {team.top_player_name} ({team.top_player_value?.toLocaleString()})
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-700">{team.offense_value.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-700">
                          {team.idp_value > 0 ? team.idp_value.toLocaleString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-right text-lg font-bold text-blue-600">{team.total_value.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {getRankChangeIcon(team.rank_change)}
                            <span className={`font-semibold ${
                              team.rank_change && team.rank_change > 0 ? 'text-green-600' :
                              team.rank_change && team.rank_change < 0 ? 'text-red-600' :
                              'text-gray-500'
                            }`}>
                              {getRankChangeText(team.rank_change)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 bg-white rounded-lg shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">About Rankings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                <div>
                  <p className="mb-2">
                    <strong>Total Value:</strong> Sum of all player FDP values on roster
                  </p>
                  <p className="mb-2">
                    <strong>Movement:</strong> Rank change compared to previous week
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span>Improved rank</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span>Declined rank</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Minus className="w-4 h-4 text-gray-400" />
                    <span>No change or first week</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer CTA */}
        <div className="mt-6 bg-white rounded-lg shadow-xl p-6 text-center">
          <div className="text-gray-600 mb-4">
            Powered by <span className="font-bold text-blue-600">FantasyDraftPros</span>
          </div>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Analyze Your League
          </a>
        </div>
      </div>
    </div>
  );
}
