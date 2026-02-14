import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertCircle, Trophy, Flame, Activity } from 'lucide-react';
import ValueChart from './ValueChart';
import { ListSkeleton } from './LoadingSkeleton';

interface PlayerDetailProps {
  playerId: string;
  onBack: () => void;
}

interface PlayerData {
  ok: boolean;
  player: {
    id: string;
    name: string;
    position: string;
    team: string | null;
  };
  latest: {
    ktc_value: number;
    fdp_value: number;
    rank: number;
    updated_at: string;
  };
  history: Array<{
    date: string;
    ktc: number;
    fdp: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  badges: {
    breakout: boolean;
    fallingKnife: boolean;
    volatile: boolean;
  };
}

export default function PlayerDetail({ playerId, onBack }: PlayerDetailProps) {
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<string>('dynasty_sf');

  useEffect(() => {
    loadPlayerData();
  }, [playerId, format]);

  const loadPlayerData = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/player-detail?id=${playerId}&format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const result = await response.json();

      if (result.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load player data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (position: string): string => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'down': return <TrendingDown className="w-5 h-5 text-red-600" />;
      case 'stable': return <Minus className="w-5 h-5 text-gray-600" />;
    }
  };

  const getTrendText = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return 'Rising';
      case 'down': return 'Falling';
      case 'stable': return 'Stable';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Rankings
            </button>
          </div>
          <ListSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Rankings
            </button>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error || 'Player not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Rankings
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{data.player.name}</h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPositionColor(data.player.position)}`}>
                  {data.player.position}
                </span>
              </div>
              <p className="text-lg text-gray-600">{data.player.team || 'Free Agent'}</p>
            </div>

            <div className="flex items-center gap-3">
              {getTrendIcon(data.trend)}
              <span className="text-lg font-medium text-gray-700">{getTrendText(data.trend)}</span>
            </div>
          </div>

          {(data.badges.breakout || data.badges.fallingKnife || data.badges.volatile) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {data.badges.breakout && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <Flame className="w-4 h-4" />
                  Breakout (+800 last 30d)
                </span>
              )}
              {data.badges.fallingKnife && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <TrendingDown className="w-4 h-4" />
                  Falling Knife (-800 last 30d)
                </span>
              )}
              {data.badges.volatile && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                  <Activity className="w-4 h-4" />
                  Volatile
                </span>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">FDP Value</p>
              <p className="text-3xl font-bold text-blue-600">{data.latest.fdp_value.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">KTC Value</p>
              <p className="text-3xl font-bold text-gray-700">{data.latest.ktc_value.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Position Rank</p>
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-purple-600" />
                <p className="text-3xl font-bold text-purple-600">#{data.latest.rank}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Value History</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('dynasty_sf')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  format === 'dynasty_sf'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Superflex
              </button>
              <button
                onClick={() => setFormat('dynasty_1qb')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  format === 'dynasty_1qb'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                1QB
              </button>
              <button
                onClick={() => setFormat('dynasty_tep')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  format === 'dynasty_tep'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                TEP
              </button>
            </div>
          </div>

          <ValueChart data={data.history} height={400} />

          <div className="mt-4 text-sm text-gray-500">
            Last updated: {new Date(data.latest.updated_at).toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="font-semibold text-gray-900 mb-3">About This Data</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">Value Sources</p>
              <p>KTC values from KeepTradeCut, FDP values use format-adjusted multipliers</p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-1">History Range</p>
              <p>Last 180 days of value snapshots, updated daily</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
