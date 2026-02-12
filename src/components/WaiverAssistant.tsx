import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, Star, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPlayerValueById as getPlayerValue, getLeagueRosters } from '../services/sleeperApi';

interface Player {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  value: number;
  recommendation_score: number;
  reasoning: string;
}

interface WaiverAssistantProps {
  leagueId: string;
  rosterId: string;
  userId: string;
}

export default function WaiverAssistant({ leagueId, rosterId, userId }: WaiverAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');

  useEffect(() => {
    loadRecommendations();
  }, [leagueId, rosterId]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const userRoster = rosters.find((r: any) => r.roster_id.toString() === rosterId);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());
      const rostered = new Set(rosters.flatMap((r: any) => r.players || []));

      const availablePlayers = Object.entries(allPlayers)
        .filter(([id, _]) => !rostered.has(id))
        .map(([id, player]: [string, any]) => ({
          player_id: id,
          full_name: player.full_name || `${player.first_name} ${player.last_name}`,
          position: player.position,
          team: player.team || 'FA',
          status: player.status,
          injury_status: player.injury_status,
          value: 0,
          recommendation_score: 0,
          reasoning: ''
        }))
        .filter(p => {
          if (!['QB', 'RB', 'WR', 'TE'].includes(p.position)) return false;
          if (!p.team || p.team === 'FA') return false;
          if (p.status === 'Inactive' || p.status === 'Retired') return false;
          return true;
        });

      const playersToAnalyze = availablePlayers.slice(0, 200);

      const withValues = await Promise.all(
        playersToAnalyze.map(async (player) => {
          const value = await getPlayerValue(player.player_id);
          const score = calculateRecommendationScore(player, userRoster, value);
          const reasoning = generateReasoning(player, userRoster, value);
          return { ...player, value, recommendation_score: score, reasoning };
        })
      );

      const topRecommendations = withValues
        .filter(p => p.value > 50)
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, 30);

      setRecommendations(topRecommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
    setLoading(false);
  };

  const calculateRecommendationScore = (player: any, roster: any, value: number) => {
    let score = value;

    const positionCounts = (roster.players || []).reduce((acc: any, pid: string) => {
      const pos = roster.players_positions?.[pid] || 'UNKNOWN';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});

    if (positionCounts[player.position] < 3) {
      score *= 1.5;
    }

    return Math.round(score);
  };

  const generateReasoning = (player: any, roster: any, value: number) => {
    const reasons = [];

    if (value > 5000) reasons.push('Elite fantasy asset');
    else if (value > 3000) reasons.push('High-end starter');
    else if (value > 1500) reasons.push('Strong bench/flex option');
    else if (value > 500) reasons.push('Potential breakout candidate');

    const positionCounts = (roster.players || []).reduce((acc: any, pid: string) => {
      const pos = roster.players_positions?.[pid] || 'UNKNOWN';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});

    if (positionCounts[player.position] < 3) {
      reasons.push(`Fills position need at ${player.position}`);
    }

    if (player.injury_status) {
      reasons.push(`Currently: ${player.injury_status}`);
    }

    return reasons.join(' • ') || 'Available waiver wire player';
  };

  const saveRecommendation = async (player: Player) => {
    try {
      await supabase.from('waiver_recommendations').insert({
        league_id: leagueId,
        user_id: userId,
        player_id: player.player_id,
        player_name: player.full_name,
        position: player.position,
        value: player.value,
        recommendation_score: player.recommendation_score,
        reasoning: player.reasoning
      });
    } catch (error) {
      console.error('Error saving recommendation:', error);
    }
  };

  const filteredRecommendations = recommendations.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || p.position === positionFilter;
    return matchesSearch && matchesPosition;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Waiver Wire Assistant</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="mb-4">
            <p className="text-sm text-gray-400">
              Showing available players from your league's waiver wire, ranked by value and positional need
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
            <button
              onClick={loadRecommendations}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Analyzing waiver wire...</p>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
            <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Players Found</h3>
            <p className="text-gray-400">
              {searchTerm || positionFilter !== 'ALL'
                ? 'Try adjusting your filters to see more recommendations'
                : 'All valuable players appear to be rostered in your league'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((player, index) => (
              <div
                key={player.player_id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                      <div>
                        <h3 className="text-xl font-bold">{player.full_name}</h3>
                        <p className="text-gray-400">{player.position} - {player.team}</p>
                      </div>
                    </div>
                    <div className="flex gap-6 mt-4">
                      <div>
                        <p className="text-sm text-gray-400">KTC Value</p>
                        <p className="text-2xl font-bold text-green-400">{player.value.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Recommendation Score</p>
                        <p className="text-2xl font-bold text-blue-400">{player.recommendation_score.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-gray-700/30 rounded-lg">
                      <p className="text-sm text-gray-300">{player.reasoning}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => saveRecommendation(player)}
                    className="ml-4 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                    title="Save recommendation"
                  >
                    <Star className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
