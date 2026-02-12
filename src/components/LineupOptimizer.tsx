import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface Player {
  player_id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  projected_points?: number;
}

interface LineupSlot {
  position: string;
  player: Player | null;
  isOptimal: boolean;
}

interface LineupOptimizerProps {
  leagueId: string;
  rosterId: string;
}

export default function LineupOptimizer({ leagueId, rosterId }: LineupOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [roster, setRoster] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [optimalLineup, setOptimalLineup] = useState<LineupSlot[]>([]);

  useEffect(() => {
    loadRosterAndOptimize();
  }, [leagueId, rosterId]);

  const loadRosterAndOptimize = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const userRoster = rosters.find((r: any) => r.roster_id.toString() === rosterId);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      setRoster(userRoster);

      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

      const rosterPlayers = await Promise.all(
        (userRoster.players || []).map(async (playerId: string) => {
          const playerData = allPlayers[playerId];
          if (!playerData) return null;

          const value = await getPlayerValue(playerId);
          return {
            player_id: playerId,
            name: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
            position: playerData.position,
            team: playerData.team || 'FA',
            value,
            projected_points: value / 100
          };
        })
      );

      const validPlayers = rosterPlayers.filter(p => p !== null) as Player[];
      setPlayers(validPlayers);

      const currentLineup = buildCurrentLineup(userRoster, validPlayers);
      setLineup(currentLineup);

      const optimal = optimizeLineup(validPlayers);
      setOptimalLineup(optimal);
    } catch (error) {
      console.error('Error loading lineup:', error);
    }
    setLoading(false);
  };

  const buildCurrentLineup = (roster: any, players: Player[]): LineupSlot[] => {
    const starters = roster.starters || [];
    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX'];

    return positions.map((pos, index) => {
      const playerId = starters[index];
      const player = players.find(p => p.player_id === playerId);
      return {
        position: pos,
        player: player || null,
        isOptimal: false
      };
    });
  };

  const optimizeLineup = (players: Player[]): LineupSlot[] => {
    const sorted = [...players].sort((a, b) => (b.projected_points || 0) - (a.projected_points || 0));

    const lineup: LineupSlot[] = [];
    const used = new Set<string>();

    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX'];

    for (const pos of positions) {
      let player: Player | null = null;

      if (pos === 'FLEX') {
        player = sorted.find(p =>
          !used.has(p.player_id) && ['RB', 'WR', 'TE'].includes(p.position)
        ) || null;
      } else if (pos === 'SUPER_FLEX') {
        player = sorted.find(p => !used.has(p.player_id)) || null;
      } else {
        player = sorted.find(p =>
          !used.has(p.player_id) && p.position === pos
        ) || null;
      }

      if (player) {
        used.add(player.player_id);
      }

      lineup.push({
        position: pos,
        player,
        isOptimal: true
      });
    }

    return lineup;
  };

  const calculateLineupValue = (lineup: LineupSlot[]) => {
    return lineup.reduce((sum, slot) => sum + (slot.player?.value || 0), 0);
  };

  const currentValue = calculateLineupValue(lineup);
  const optimalValue = calculateLineupValue(optimalLineup);
  const improvement = optimalValue - currentValue;

  const renderLineupSlot = (slot: LineupSlot, index: number) => (
    <div
      key={index}
      className={`p-4 rounded-lg border ${
        slot.isOptimal
          ? 'bg-green-500/10 border-green-500'
          : 'bg-gray-800/50 border-gray-700'
      }`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-400 mb-1">{slot.position}</p>
          {slot.player ? (
            <>
              <p className="font-semibold">{slot.player.name}</p>
              <p className="text-sm text-gray-400">{slot.player.position} - {slot.player.team}</p>
              <p className="text-sm text-blue-400 mt-1">
                Value: {slot.player.value.toLocaleString()}
              </p>
              <p className="text-sm text-green-400">
                Proj: {(slot.player.projected_points || 0).toFixed(1)} pts
              </p>
            </>
          ) : (
            <p className="text-gray-500 italic">Empty</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Lineup Optimizer</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Optimizing lineup...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 mb-2">Current Lineup Value</p>
                <p className="text-3xl font-bold">{currentValue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 mb-2">Optimal Lineup Value</p>
                <p className="text-3xl font-bold text-green-400">{optimalValue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 mb-2">Potential Improvement</p>
                <p className={`text-3xl font-bold ${improvement > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  {improvement > 0 ? '+' : ''}{improvement.toLocaleString()}
                </p>
              </div>
            </div>

            {improvement > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 mb-8 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-500">Lineup Improvement Available</p>
                  <p className="text-sm text-gray-300 mt-1">
                    Your lineup could be improved by {improvement.toLocaleString()} value points. Check the optimal lineup below.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Current Lineup</h2>
                <div className="space-y-3">
                  {lineup.map((slot, index) => renderLineupSlot(slot, index))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                  Optimal Lineup
                </h2>
                <div className="space-y-3">
                  {optimalLineup.map((slot, index) => renderLineupSlot(slot, index))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Bench Players</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players
                  .filter(p => !optimalLineup.some(slot => slot.player?.player_id === p.player_id))
                  .sort((a, b) => b.value - a.value)
                  .map(player => (
                    <div key={player.player_id} className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-gray-400">{player.position} - {player.team}</p>
                      <p className="text-sm text-blue-400 mt-2">Value: {player.value.toLocaleString()}</p>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
