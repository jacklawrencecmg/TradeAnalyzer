import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Eye, Calendar, Share2, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SharedTradePageProps {
  slug: string;
}

interface TradeAsset {
  id?: string;
  name: string;
  position: string;
  value: number;
}

interface TradePick {
  round: number;
  year: number;
  value: number;
}

interface TradeSide {
  players: TradeAsset[];
  picks?: TradePick[];
  faab?: number;
}

interface SharedTrade {
  id: string;
  slug: string;
  format: string;
  side_a: TradeSide;
  side_b: TradeSide;
  side_a_total: number;
  side_b_total: number;
  fairness_percentage: number;
  winner: 'side_a' | 'side_b' | 'even';
  recommendation: string;
  hide_values: boolean;
  created_at: string;
  view_count: number;
}

export default function SharedTradePage({ slug }: SharedTradePageProps) {
  const [trade, setTrade] = useState<SharedTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrade();
  }, [slug]);

  useEffect(() => {
    if (trade) {
      updateMetaTags();
    }
  }, [trade]);

  const updateMetaTags = () => {
    if (!trade) return;

    const { side_a, side_b, fairness_percentage, winner } = trade;
    const winnerSide = winner === 'side_a' ? 'Team A Wins' : winner === 'side_b' ? 'Team B Wins' : 'Even Trade';

    const title = `Trade Analysis: ${fairness_percentage}% Fair - ${winnerSide}`;
    const description = `Team A vs Team B dynasty fantasy football trade comparison. ${fairness_percentage}% fairness rating.`;
    const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-og-image/${slug}`;
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

  const fetchTrade = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-share?slug=${slug}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Trade not found');
      }

      const data = await response.json();
      if (data.ok && data.trade) {
        setTrade(data.trade);
      } else {
        throw new Error('Trade not found');
      }
    } catch (err) {
      console.error('Error fetching trade:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trade');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading trade...</div>
      </div>
    );
  }

  if (error || !trade) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trade Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This trade link may be invalid or expired.'}</p>
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

  const { side_a, side_b, side_a_total, side_b_total, fairness_percentage, winner, recommendation, format, hide_values, created_at, view_count } = trade;

  const difference = Math.abs(side_a_total - side_b_total);
  const winnerSide = winner === 'side_a' ? 'Team A' : winner === 'side_b' ? 'Team B' : 'Even';
  const isEven = winner === 'even';

  const getWinnerClass = (side: 'a' | 'b') => {
    if (isEven) return 'border-gray-300';
    if ((side === 'a' && winner === 'side_a') || (side === 'b' && winner === 'side_b')) {
      return 'border-green-500 bg-green-50';
    }
    return 'border-red-300 bg-red-50';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <img
              src="/FDP2.png"
              alt="Fantasy Draft Pros"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Trade Analysis</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(created_at)}
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {view_count} views
                </div>
                <div className="flex items-center gap-1">
                  {hide_values ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {hide_values ? 'Values Hidden' : 'Values Visible'}
                </div>
              </div>
            </div>
            <button
              onClick={copyLink}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Copy Link
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
              <div className="text-sm text-blue-700 font-medium mb-1">Fairness</div>
              <div className="text-3xl font-bold text-blue-900">{fairness_percentage}%</div>
            </div>
            <div className={`rounded-lg p-4 text-center ${isEven ? 'bg-gradient-to-br from-gray-50 to-gray-100' : 'bg-gradient-to-br from-green-50 to-green-100'}`}>
              <div className={`text-sm font-medium mb-1 ${isEven ? 'text-gray-700' : 'text-green-700'}`}>Winner</div>
              <div className={`text-3xl font-bold ${isEven ? 'text-gray-900' : 'text-green-900'}`}>{winnerSide}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 text-center">
              <div className="text-sm text-orange-700 font-medium mb-1">Format</div>
              <div className="text-lg font-bold text-orange-900">{format.replace(/_/g, ' ').toUpperCase()}</div>
            </div>
          </div>

          {recommendation && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="font-semibold text-blue-900 mb-1">Recommendation</div>
              <div className="text-blue-800">{recommendation}</div>
            </div>
          )}
        </div>

        {/* Trade Sides */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Team A */}
          <div className={`bg-white rounded-lg shadow-xl border-4 ${getWinnerClass('a')} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Team A Gives</h2>
              {winner === 'side_a' && <TrendingUp className="w-6 h-6 text-green-600" />}
              {winner === 'side_b' && <TrendingDown className="w-6 h-6 text-red-600" />}
            </div>

            {side_a.players && side_a.players.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Players</h3>
                <div className="space-y-2">
                  {side_a.players.map((player, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-600">{player.position}</div>
                      </div>
                      {!hide_values && (
                        <div className="text-lg font-bold text-blue-600">{player.value.toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {side_a.picks && side_a.picks.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Draft Picks</h3>
                <div className="space-y-2">
                  {side_a.picks.map((pick, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="font-semibold text-gray-900">
                        {pick.year} Round {pick.round}
                      </div>
                      {!hide_values && (
                        <div className="text-lg font-bold text-blue-600">{pick.value.toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {side_a.faab && side_a.faab > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">FAAB</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">${side_a.faab}</div>
                </div>
              </div>
            )}

            {!hide_values && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900">Total Value</div>
                  <div className="text-2xl font-bold text-blue-600">{side_a_total.toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>

          {/* Team B */}
          <div className={`bg-white rounded-lg shadow-xl border-4 ${getWinnerClass('b')} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Team B Gives</h2>
              {winner === 'side_b' && <TrendingUp className="w-6 h-6 text-green-600" />}
              {winner === 'side_a' && <TrendingDown className="w-6 h-6 text-red-600" />}
            </div>

            {side_b.players && side_b.players.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Players</h3>
                <div className="space-y-2">
                  {side_b.players.map((player, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-semibold text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-600">{player.position}</div>
                      </div>
                      {!hide_values && (
                        <div className="text-lg font-bold text-blue-600">{player.value.toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {side_b.picks && side_b.picks.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Draft Picks</h3>
                <div className="space-y-2">
                  {side_b.picks.map((pick, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="font-semibold text-gray-900">
                        {pick.year} Round {pick.round}
                      </div>
                      {!hide_values && (
                        <div className="text-lg font-bold text-blue-600">{pick.value.toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {side_b.faab && side_b.faab > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">FAAB</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold text-gray-900">${side_b.faab}</div>
                </div>
              </div>
            )}

            {!hide_values && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-900">Total Value</div>
                  <div className="text-2xl font-bold text-blue-600">{side_b_total.toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        {!hide_values && (
          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Trade Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700 font-medium mb-1">Value Difference</div>
                <div className="text-2xl font-bold text-blue-900">{difference.toLocaleString()}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-700 font-medium mb-1">Fairness Rating</div>
                <div className="text-2xl font-bold text-green-900">
                  {fairness_percentage >= 95 ? 'Excellent' : fairness_percentage >= 85 ? 'Good' : fairness_percentage >= 75 ? 'Fair' : 'Unbalanced'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-white rounded-lg shadow-xl p-6 text-center">
          <div className="text-gray-600 mb-4">
            Powered by <span className="font-bold text-blue-600">FantasyDraftPros</span>
          </div>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Analyze Your Own Trades
          </a>
        </div>
      </div>
    </div>
  );
}
