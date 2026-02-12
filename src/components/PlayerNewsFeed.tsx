import React, { useState, useEffect } from 'react';
import { Newspaper, TrendingUp, AlertCircle } from 'lucide-react';

interface NewsItem {
  id: string;
  player_name: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  type: 'injury' | 'trade' | 'depth_chart' | 'performance';
  timestamp: string;
}

export default function PlayerNewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const mockNews: NewsItem[] = [
        {
          id: '1',
          player_name: 'Patrick Mahomes',
          title: 'Mahomes practices in full, ready for Week 1',
          description: 'Chiefs QB participated fully in practice and is expected to start Week 1.',
          impact: 'low',
          type: 'performance',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '2',
          player_name: 'Jonathan Taylor',
          title: 'Taylor listed as questionable for Week 1',
          description: 'RB dealing with ankle injury, game-time decision expected.',
          impact: 'high',
          type: 'injury',
          timestamp: new Date(Date.now() - 7200000).toISOString()
        },
        {
          id: '3',
          player_name: 'Davante Adams',
          title: 'Adams moves up depth chart',
          description: 'WR now listed as WR1 on official depth chart.',
          impact: 'medium',
          type: 'depth_chart',
          timestamp: new Date(Date.now() - 10800000).toISOString()
        },
        {
          id: '4',
          player_name: 'Travis Kelce',
          title: 'Kelce signs contract extension',
          description: 'TE agrees to 2-year extension with Chiefs.',
          impact: 'medium',
          type: 'trade',
          timestamp: new Date(Date.now() - 14400000).toISOString()
        }
      ];

      setNews(mockNews);
    } catch (error) {
      console.error('Error loading news:', error);
    }
    setLoading(false);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-500/20 border-red-500/30 text-red-400';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
      case 'low': return 'bg-green-500/20 border-green-500/30 text-green-400';
      default: return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'injury': return <AlertCircle className="w-5 h-5" />;
      case 'trade': return <TrendingUp className="w-5 h-5" />;
      default: return <Newspaper className="w-5 h-5" />;
    }
  };

  const filteredNews = filter === 'all' ? news : news.filter(n => n.type === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Newspaper className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Player News Feed</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'all' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              All News
            </button>
            <button
              onClick={() => setFilter('injury')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'injury' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Injuries
            </button>
            <button
              onClick={() => setFilter('trade')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'trade' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Trades
            </button>
            <button
              onClick={() => setFilter('depth_chart')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'depth_chart' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              Depth Chart
            </button>
            <button
              onClick={loadNews}
              disabled={loading}
              className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading news...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNews.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                        <p className="text-sm text-gray-400">{item.player_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getImpactColor(item.impact)}`}>
                          {item.impact.toUpperCase()} IMPACT
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-3">{item.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
