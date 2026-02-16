import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import {
  getLeagueRosters,
  getPlayerValueById as getPlayerValue,
  fetchLeagueUsers,
  fetchAllPlayers,
  fetchLeagueDetails,
  getLeagueSettings,
  type LeagueSettings
} from '../services/sleeperApi';
import { PlayerAvatar } from './PlayerAvatar';
import { AchievementBadge } from './AchievementBadge';

interface Player {
  player_id: string;
  name: string;
  position: string;
  team: string;
  value: number;
  projected_points?: number;
  injury_status?: string;
}

interface LineupSlot {
  position: string;
  player: Player | null;
  isOptimal: boolean;
  suggestion?: string;
}

interface TeamInfo {
  roster_id: number;
  team_name: string;
  owner_id: string;
}

interface LineupOptimizerProps {
  leagueId: string;
  rosterId?: string;
}

export default function LineupOptimizer({ leagueId, rosterId }: LineupOptimizerProps) {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [roster, setRoster] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [optimalLineup, setOptimalLineup] = useState<LineupSlot[]>([]);
  const [leagueSettings, setLeagueSettings] = useState<Partial<LeagueSettings>>({});

  useEffect(() => {
    loadLeagueSettings();
    loadTeams();
  }, [leagueId]);

  const loadLeagueSettings = async () => {
    try {
      const league = await fetchLeagueDetails(leagueId);
      const settings = getLeagueSettings(league);
      setLeagueSettings(settings);
    } catch (error) {
      console.error('Error loading league settings:', error);
    }
  };

  useEffect(() => {
    if (selectedTeam) {
      loadRosterAndOptimize();
    }
  }, [selectedTeam]);

  const loadTeams = async () => {
    try {
      const [rosters, users] = await Promise.all([
        getLeagueRosters(leagueId),
        fetchLeagueUsers(leagueId)
      ]);

      const userMap = new Map(
        users.map(user => [
          user.user_id,
          user.metadata?.team_name || user.display_name || user.username || `Team ${user.user_id.slice(0, 4)}`
        ])
      );

      const teamList = rosters.map((roster: any) => ({
        roster_id: roster.roster_id,
        team_name: userMap.get(roster.owner_id) || `Team ${roster.roster_id}`,
        owner_id: roster.owner_id
      }));

      setTeams(teamList);

      if (rosterId) {
        setSelectedTeam(rosterId);
      } else if (teamList.length > 0) {
        setSelectedTeam(teamList[0].roster_id.toString());
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadRosterAndOptimize = async () => {
    if (!selectedTeam) return;

    setLoading(true);
    try {
      const [rosters, allPlayers] = await Promise.all([
        getLeagueRosters(leagueId),
        fetchAllPlayers()
      ]);

      const userRoster = rosters.find((r: any) => r.roster_id.toString() === selectedTeam);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      setRoster(userRoster);

      // Batch fetch all player values at once
      const playerIds = userRoster.players || [];
      const playerValuesMap = new Map<string, number>();
      await Promise.all(
        playerIds.map(async (playerId: string) => {
          try {
            const value = await getPlayerValue(playerId, leagueSettings);
            playerValuesMap.set(playerId, value);
          } catch (err) {
            console.error(`Error fetching value for ${playerId}:`, err);
            playerValuesMap.set(playerId, 0);
          }
        })
      );

      const rosterPlayers = playerIds
        .map((playerId: string) => {
          const playerData = allPlayers[playerId];
          if (!playerData) return null;

          const value = playerValuesMap.get(playerId) || 0;
          return {
            player_id: playerId,
            name: playerData.full_name,
            position: playerData.position,
            team: playerData.team || 'FA',
            value,
            projected_points: value / 100,
            injury_status: playerData.injury_status
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const validPlayers = rosterPlayers as Player[];
      setPlayers(validPlayers);

      const currentLineup = buildCurrentLineup(userRoster, validPlayers);
      setLineup(currentLineup);

      const optimal = optimizeLineup(validPlayers, currentLineup);
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

  const optimizeLineup = (players: Player[], currentLineup: LineupSlot[]): LineupSlot[] => {
    const sorted = [...players].sort((a, b) => {
      if (a.injury_status && !b.injury_status) return 1;
      if (!a.injury_status && b.injury_status) return -1;
      return (b.projected_points || 0) - (a.projected_points || 0);
    });

    const lineup: LineupSlot[] = [];
    const used = new Set<string>();

    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'SUPER_FLEX'];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      let player: Player | null = null;
      let suggestion = '';

      if (pos === 'FLEX') {
        player = sorted.find(p =>
          !used.has(p.player_id) && ['RB', 'WR', 'TE'].includes(p.position) && !p.injury_status
        ) || null;
      } else if (pos === 'SUPER_FLEX') {
        player = sorted.find(p => !used.has(p.player_id) && !p.injury_status) || null;
      } else {
        player = sorted.find(p =>
          !used.has(p.player_id) && p.position === pos && !p.injury_status
        ) || null;
      }

      const currentPlayer = currentLineup[i]?.player;
      if (player && currentPlayer && player.player_id !== currentPlayer.player_id) {
        const valueDiff = player.value - currentPlayer.value;
        const ptsDiff = (player.projected_points || 0) - (currentPlayer.projected_points || 0);

        if (valueDiff > 500) {
          suggestion = `Swap in ${player.name} for ${currentPlayer.name} (+${valueDiff.toLocaleString()} value, +${ptsDiff.toFixed(1)} pts)`;
        } else if (currentPlayer.injury_status) {
          suggestion = `${currentPlayer.name} is injured - start ${player.name} instead`;
        }
      }

      if (player) {
        used.add(player.player_id);
      }

      lineup.push({
        position: pos,
        player,
        isOptimal: true,
        suggestion
      });
    }

    return lineup;
  };

  const calculateLineupValue = (lineup: LineupSlot[]) => {
    return lineup.reduce((sum, slot) => sum + (slot.player?.value || 0), 0);
  };

  const calculateLineupPoints = (lineup: LineupSlot[]) => {
    return lineup.reduce((sum, slot) => sum + (slot.player?.projected_points || 0), 0);
  };

  const currentValue = calculateLineupValue(lineup);
  const optimalValue = calculateLineupValue(optimalLineup);
  const improvement = optimalValue - currentValue;

  const currentPoints = calculateLineupPoints(lineup);
  const optimalPoints = calculateLineupPoints(optimalLineup);
  const pointsImprovement = optimalPoints - currentPoints;

  const suggestions = optimalLineup.filter(slot => slot.suggestion).map(slot => slot.suggestion);

  const renderLineupSlot = (slot: LineupSlot, index: number, isOptimal = false) => {
    const isDifferent = isOptimal && slot.player && lineup[index]?.player?.player_id !== slot.player.player_id;
    const hasInjury = slot.player?.injury_status && ['Out', 'Doubtful', 'Questionable', 'IR', 'PUP'].includes(slot.player.injury_status);

    return (
      <div
        key={index}
        className={`p-4 rounded-lg border transition hover-lift card-enter ${
          isDifferent
            ? 'bg-fdp-accent-1/10 border-fdp-accent-1'
            : slot.player?.injury_status
            ? 'bg-fdp-neg/10 border-fdp-neg/50'
            : 'bg-fdp-surface-2 border-fdp-border-1'
        }`}
      >
        <div className="flex items-center gap-3">
          {slot.player && (
            <PlayerAvatar
              playerName={slot.player.name}
              team={slot.player.team}
              position={slot.player.position}
              size="md"
              showTeamLogo={true}
              showBadge={hasInjury}
              badgeContent={hasInjury ? <AchievementBadge type="injury" size="sm" /> : undefined}
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-sm font-semibold text-fdp-text-3">{slot.position}</p>
              {isDifferent && (
                <AchievementBadge type="trending" size="sm" label="Better" />
              )}
              {slot.player?.injury_status && (
                <span className="text-xs px-2 py-0.5 bg-fdp-neg/20 text-fdp-neg rounded-full">
                  {slot.player.injury_status}
                </span>
              )}
            </div>
            {slot.player ? (
              <>
                <p className="font-semibold text-fdp-text-1">{slot.player.name}</p>
                <p className="text-sm text-fdp-text-3">{slot.player.position} - {slot.player.team}</p>
                <div className="flex gap-4 mt-2">
                  <p className="text-sm text-fdp-accent-1">
                    Value: {slot.player.value.toLocaleString()}
                  </p>
                  <p className="text-sm text-fdp-pos">
                    Proj: {(slot.player.projected_points || 0).toFixed(1)} pts
                  </p>
                </div>
              </>
            ) : (
              <p className="text-fdp-text-3 italic">Empty</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 text-fdp-text-1 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-fdp-accent-1" />
            <h1 className="text-3xl font-bold">Lineup Optimizer</h1>
          </div>
          {leagueSettings.isSuperflex && (
            <span className="px-4 py-2 bg-fdp-accent-1/20 text-fdp-accent-1 rounded-lg text-sm font-semibold border border-fdp-accent-1/50">
              Superflex League • QB Premium Values
            </span>
          )}
        </div>

        <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fdp-text-2 mb-2">
                Select Team
              </label>
              <div className="flex gap-4">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="flex-1 px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-fdp-accent-1"
                >
                  <option value="">Select a team...</option>
                  {teams.map(team => (
                    <option key={team.roster_id} value={team.roster_id.toString()}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadRosterAndOptimize}
                  disabled={loading || !selectedTeam}
                  className="px-6 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  {loading ? 'Optimizing...' : 'Optimize'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-fdp-accent-1 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-fdp-text-3">Optimizing lineup...</p>
          </div>
        ) : !selectedTeam ? (
          <div className="text-center py-12 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
            <Users className="w-16 h-16 text-fdp-border-1 mx-auto mb-4" />
            <p className="text-fdp-text-3">Select a team to optimize their lineup</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6">
                <p className="text-fdp-text-3 text-sm mb-2">Current Value</p>
                <p className="text-3xl font-bold text-fdp-text-1">{currentValue.toLocaleString()}</p>
                <p className="text-sm text-fdp-text-3 mt-1">{currentPoints.toFixed(1)} pts</p>
              </div>
              <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6">
                <p className="text-fdp-text-3 text-sm mb-2">Optimal Value</p>
                <p className="text-3xl font-bold text-fdp-pos">{optimalValue.toLocaleString()}</p>
                <p className="text-sm text-fdp-text-3 mt-1">{optimalPoints.toFixed(1)} pts</p>
              </div>
              <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6">
                <p className="text-fdp-text-3 text-sm mb-2">Value Gain</p>
                <p className={`text-3xl font-bold ${improvement > 0 ? 'text-fdp-pos' : 'text-fdp-text-3'}`}>
                  {improvement > 0 ? '+' : ''}{improvement.toLocaleString()}
                </p>
                <p className={`text-sm mt-1 ${pointsImprovement > 0 ? 'text-fdp-pos' : 'text-fdp-text-3'}`}>
                  {pointsImprovement > 0 ? '+' : ''}{pointsImprovement.toFixed(1)} pts
                </p>
              </div>
              <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6">
                <p className="text-fdp-text-3 text-sm mb-2">Changes Needed</p>
                <p className="text-3xl font-bold text-fdp-accent-1">{suggestions.length}</p>
                <p className="text-sm text-fdp-text-3 mt-1">suggested swaps</p>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="bg-fdp-accent-1/10 border border-fdp-accent-1 rounded-lg p-4 mb-8">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-fdp-accent-1 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-fdp-accent-1 mb-2">Lineup Improvements Available</p>
                    <ul className="space-y-1">
                      {suggestions.map((suggestion, i) => (
                        <li key={i} className="text-sm text-fdp-text-2">• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-4 text-fdp-text-1">Current Lineup</h2>
                <div className="space-y-3">
                  {lineup.map((slot, index) => renderLineupSlot(slot, index, false))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-fdp-text-1">
                  <TrendingUp className="w-6 h-6 text-fdp-pos" />
                  Optimal Lineup
                </h2>
                <div className="space-y-3">
                  {optimalLineup.map((slot, index) => renderLineupSlot(slot, index, true))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4 text-fdp-text-1">Bench Players</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players
                  .filter(p => !optimalLineup.some(slot => slot.player?.player_id === p.player_id))
                  .sort((a, b) => b.value - a.value)
                  .map(player => {
                    const hasInjury = player.injury_status && ['Out', 'Doubtful', 'Questionable', 'IR', 'PUP'].includes(player.injury_status);
                    return (
                      <div key={player.player_id} className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-4 hover:border-fdp-accent-1 transition hover-lift card-enter">
                        <div className="flex items-center gap-3 mb-2">
                          <PlayerAvatar
                            playerName={player.name}
                            team={player.team}
                            position={player.position}
                            size="sm"
                            showTeamLogo={true}
                            showBadge={hasInjury}
                            badgeContent={hasInjury ? <AchievementBadge type="injury" size="sm" /> : undefined}
                          />
                          <div className="flex-1">
                            <p className="font-semibold text-fdp-text-1">{player.name}</p>
                            {player.injury_status && (
                              <span className="text-xs px-2 py-0.5 bg-fdp-neg/20 text-fdp-neg rounded-full">
                                {player.injury_status}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-fdp-text-3">{player.position} - {player.team}</p>
                        <div className="flex gap-4 mt-2">
                          <p className="text-sm text-fdp-accent-1">Value: {player.value.toLocaleString()}</p>
                          <p className="text-sm text-fdp-text-3">Proj: {(player.projected_points || 0).toFixed(1)} pts</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
