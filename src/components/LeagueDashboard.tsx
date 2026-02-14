import React, { useState, useEffect } from 'react';
import { Trophy, Users, TrendingUp, ArrowLeft, Loader, AlertCircle, Award, Target } from 'lucide-react';
import { ListSkeleton } from './LoadingSkeleton';

interface Player {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  fdp_value: number;
  is_starter: boolean;
}

interface Roster {
  roster_id: number;
  team_name: string;
  owner_name: string;
  owner_id: string;
  players: Player[];
  total_value: number;
  record: {
    wins: number;
    losses: number;
    ties: number;
  };
}

interface TradeSuggestion {
  team_a: {
    roster_id: number;
    team_name: string;
    owner_name: string;
  };
  team_b: {
    roster_id: number;
    team_name: string;
    owner_name: string;
  };
  team_a_gives: Player[];
  team_a_receives: Player[];
  team_b_gives: Player[];
  team_b_receives: Player[];
  value_difference: number;
  fairness_score: number;
  improves_both: boolean;
  trade_type: string;
}

interface LeagueDashboardProps {
  leagueId: string;
  leagueName: string;
  onBack: () => void;
}

export default function LeagueDashboard({ leagueId, leagueName, onBack }: LeagueDashboardProps) {
  const [tab, setTab] = useState<'rankings' | 'rosters' | 'suggestions'>('rankings');
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [suggestions, setSuggestions] = useState<TradeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeagueData();
  }, [leagueId]);

  const loadLeagueData = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const rostersRes = await fetch(
        `${supabaseUrl}/functions/v1/league-rosters?league_id=${leagueId}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const rostersData = await rostersRes.json();

      if (rostersData.ok) {
        const sortedRosters = rostersData.rosters.sort((a: Roster, b: Roster) =>
          b.total_value - a.total_value
        );
        setRosters(sortedRosters);
      } else {
        setError(rostersData.error || 'Failed to load rosters');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load league data');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    if (suggestions.length > 0) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const suggestionsRes = await fetch(
        `${supabaseUrl}/functions/v1/league-suggestions?league_id=${leagueId}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      const suggestionsData = await suggestionsRes.json();

      if (suggestionsData.ok) {
        setSuggestions(suggestionsData.suggestions);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  useEffect(() => {
    if (tab === 'suggestions' && suggestions.length === 0) {
      loadSuggestions();
    }
  }, [tab]);

  const getPositionColor = (position: string): string => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            Back to Import
          </button>
        </div>
        <ListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            Back to Import
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-5 h-5" />
          Back to Import
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{leagueName}</h1>
            <p className="text-gray-600 mt-1">{rosters.length} teams analyzed with FDP values</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setTab('rankings')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                tab === 'rankings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Power Rankings
              </div>
            </button>
            <button
              onClick={() => setTab('rosters')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                tab === 'rosters'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Rosters
              </div>
            </button>
            <button
              onClick={() => setTab('suggestions')}
              className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                tab === 'suggestions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Trade Suggestions
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {tab === 'rankings' && (
            <div className="space-y-3">
              {rosters.map((roster, index) => (
                <div
                  key={roster.roster_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold w-12 text-center">
                      {getRankBadge(index + 1)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{roster.owner_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>{roster.players.length} players</span>
                        <span>
                          {roster.record.wins}-{roster.record.losses}
                          {roster.record.ties > 0 && `-${roster.record.ties}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {roster.total_value.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Total Value</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'rosters' && (
            <div className="space-y-6">
              {rosters.map((roster, index) => (
                <div key={roster.roster_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold">{getRankBadge(index + 1)}</span>
                      <h3 className="font-semibold text-gray-900">{roster.owner_name}</h3>
                    </div>
                    <p className="text-lg font-bold text-blue-600">
                      {roster.total_value.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {roster.players
                        .sort((a, b) => b.fdp_value - a.fdp_value)
                        .slice(0, 12)
                        .map((player) => (
                          <div
                            key={player.player_id}
                            className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPositionColor(player.position)}`}>
                                {player.position}
                              </span>
                              <span className="text-sm text-gray-900 truncate">{player.name}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 ml-2">
                              {player.fdp_value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                    {roster.players.length > 12 && (
                      <p className="text-sm text-gray-600 mt-3 text-center">
                        + {roster.players.length - 12} more players
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'suggestions' && (
            <div>
              {suggestions.length === 0 ? (
                <div className="text-center py-12">
                  <Loader className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Analyzing rosters and generating trade suggestions...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">
                          {suggestion.team_a.owner_name} ⇄ {suggestion.team_b.owner_name}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                            {suggestion.trade_type}
                          </span>
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                            suggestion.fairness_score >= 90
                              ? 'bg-green-100 text-green-800'
                              : suggestion.fairness_score >= 75
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {suggestion.fairness_score}% Fair
                          </span>
                          {suggestion.improves_both && (
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                              Win-Win
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-3">
                            {suggestion.team_a.owner_name} Receives:
                          </h4>
                          {suggestion.team_a_receives.map((player) => (
                            <div key={player.player_id} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPositionColor(player.position)}`}>
                                  {player.position}
                                </span>
                                <span className="text-sm text-gray-900">{player.name}</span>
                              </div>
                              <span className="text-sm font-medium text-green-600">
                                {player.fdp_value.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <h4 className="font-medium text-gray-700 mb-2">Gives Up:</h4>
                            {suggestion.team_a_gives.map((player) => (
                              <div key={player.player_id} className="flex items-center justify-between py-1">
                                <span className="text-sm text-gray-600">{player.name}</span>
                                <span className="text-sm text-gray-600">
                                  {player.fdp_value.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-3">
                            {suggestion.team_b.owner_name} Receives:
                          </h4>
                          {suggestion.team_b_receives.map((player) => (
                            <div key={player.player_id} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPositionColor(player.position)}`}>
                                  {player.position}
                                </span>
                                <span className="text-sm text-gray-900">{player.name}</span>
                              </div>
                              <span className="text-sm font-medium text-green-600">
                                {player.fdp_value.toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <h4 className="font-medium text-gray-700 mb-2">Gives Up:</h4>
                            {suggestion.team_b_gives.map((player) => (
                              <div key={player.player_id} className="flex items-center justify-between py-1">
                                <span className="text-sm text-gray-600">{player.name}</span>
                                <span className="text-sm text-gray-600">
                                  {player.fdp_value.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {suggestion.value_difference > 0 && (
                        <div className="mt-4 text-sm text-gray-600 text-center">
                          Value difference: {suggestion.value_difference.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
