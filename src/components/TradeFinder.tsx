import React, { useState, useEffect } from 'react';
import { Search, ArrowLeftRight, TrendingUp, Users } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue, fetchLeagueUsers, fetchAllPlayers, SleeperPlayer } from '../services/sleeperApi';
import { PlayerAvatar } from './PlayerAvatar';
import { StatSparkline } from './StatSparkline';
import { AchievementBadge } from './AchievementBadge';

interface TradeProposal {
  target_team: string;
  roster_id: number;
  give_players: Array<{ id: string; name: string; value: number; position: string }>;
  receive_players: Array<{ id: string; name: string; value: number; position: string }>;
  value_difference: number;
  fairness_score: number;
  reasoning: string;
  match_score: number;
}

interface TeamInfo {
  roster_id: number;
  team_name: string;
  owner_id: string;
}

interface TradeFinderProps {
  leagueId: string;
  rosterId?: string;
}

export default function TradeFinder({ leagueId, rosterId }: TradeFinderProps) {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [targetPosition, setTargetPosition] = useState('ALL');

  useEffect(() => {
    loadTeams();
  }, [leagueId]);

  useEffect(() => {
    if (selectedTeam) {
      findTrades();
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

  const analyzeTeamNeeds = (players: any[], allPlayersData: Record<string, SleeperPlayer>) => {
    const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const positionValues: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const positionPlayers: Record<string, any[]> = { QB: [], RB: [], WR: [], TE: [] };

    players.forEach(p => {
      const pos = p.position;
      if (positionCounts.hasOwnProperty(pos)) {
        positionCounts[pos]++;
        positionValues[pos] += p.value;
        positionPlayers[pos].push(p);
      }
    });

    const avgValues: Record<string, number> = {};
    Object.keys(positionCounts).forEach(pos => {
      avgValues[pos] = positionCounts[pos] > 0 ? positionValues[pos] / positionCounts[pos] : 0;
    });

    const needs: string[] = [];
    const surpluses: string[] = [];

    if (positionCounts.QB < 2 || avgValues.QB < 30.0) needs.push('QB');
    if (positionCounts.RB < 4 || avgValues.RB < 25.0) needs.push('RB');
    if (positionCounts.WR < 4 || avgValues.WR < 25.0) needs.push('WR');
    if (positionCounts.TE < 2 || avgValues.TE < 15.0) needs.push('TE');

    if (positionCounts.QB > 3 && avgValues.QB > 30.0) surpluses.push('QB');
    if (positionCounts.RB > 5 && avgValues.RB > 25.0) surpluses.push('RB');
    if (positionCounts.WR > 6 && avgValues.WR > 25.0) surpluses.push('WR');
    if (positionCounts.TE > 3 && avgValues.TE > 15.0) surpluses.push('TE');

    return { needs, surpluses, positionPlayers, positionCounts, avgValues };
  };

  const findTrades = async () => {
    if (!selectedTeam) return;

    setLoading(true);
    try {
      const [rosters, users, allPlayers] = await Promise.all([
        getLeagueRosters(leagueId),
        fetchLeagueUsers(leagueId),
        fetchAllPlayers()
      ]);

      const userMap = new Map(
        users.map(user => [
          user.user_id,
          user.metadata?.team_name || user.display_name || user.username || `Team ${user.user_id.slice(0, 4)}`
        ])
      );

      const userRoster = rosters.find((r: any) => r.roster_id.toString() === selectedTeam);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      const userPlayers = await Promise.all(
        (userRoster.players || []).map(async (pid: string) => {
          const player = allPlayers[pid];
          if (!player) return null;
          return {
            id: pid,
            name: player.full_name,
            position: player.position,
            value: await getPlayerValue(pid)
          };
        })
      );

      const validUserPlayers = userPlayers.filter(p => p !== null && p.value > 5.0);
      const userAnalysis = analyzeTeamNeeds(validUserPlayers, allPlayers);

      const tradeSuggestions: TradeProposal[] = [];

      for (const roster of rosters) {
        if (roster.roster_id.toString() === selectedTeam) continue;

        const theirPlayers = await Promise.all(
          (roster.players || []).map(async (pid: string) => {
            const player = allPlayers[pid];
            if (!player) return null;
            return {
              id: pid,
              name: player.full_name,
              position: player.position,
              value: await getPlayerValue(pid)
            };
          })
        );

        const validTheirPlayers = theirPlayers.filter(p => p !== null && p.value > 5.0);
        const theirAnalysis = analyzeTeamNeeds(validTheirPlayers, allPlayers);

        for (const need of userAnalysis.needs) {
          const targetPlayers = validTheirPlayers.filter(p => p.position === need);

          for (const theirPlayer of targetPlayers) {
            for (const surplus of userAnalysis.surpluses) {
              const myPlayers = validUserPlayers.filter(p => p.position === surplus);

              for (const myPlayer of myPlayers) {
                const valueDiff = Math.abs(theirPlayer.value - myPlayer.value);
                if (valueDiff > 30.0) continue;

                const fairness = 100 - (valueDiff / Math.max(theirPlayer.value, myPlayer.value)) * 100;

                let matchScore = fairness;
                if (theirAnalysis.needs.includes(surplus)) matchScore += 20;
                if (theirAnalysis.surpluses.includes(need)) matchScore += 10;

                if (fairness >= 60) {
                  tradeSuggestions.push({
                    target_team: userMap.get(roster.owner_id) || `Team ${roster.roster_id}`,
                    roster_id: roster.roster_id,
                    give_players: [myPlayer],
                    receive_players: [theirPlayer],
                    value_difference: theirPlayer.value - myPlayer.value,
                    fairness_score: fairness,
                    match_score: matchScore,
                    reasoning: generateTradeReasoning(myPlayer, theirPlayer, userAnalysis, theirAnalysis)
                  });
                }
              }
            }
          }
        }

        for (const theirPlayer of validTheirPlayers.filter(p => userAnalysis.needs.includes(p.position))) {
          for (const myPlayer of validUserPlayers) {
            if (userAnalysis.surpluses.includes(myPlayer.position)) continue;

            const valueDiff = Math.abs(theirPlayer.value - myPlayer.value);
            if (valueDiff > 25.0) continue;

            const fairness = 100 - (valueDiff / Math.max(theirPlayer.value, myPlayer.value)) * 100;
            let matchScore = fairness;
            if (theirAnalysis.needs.includes(myPlayer.position)) matchScore += 15;

            if (fairness >= 70 && !tradeSuggestions.some(t =>
              t.give_players[0].id === myPlayer.id && t.receive_players[0].id === theirPlayer.id
            )) {
              tradeSuggestions.push({
                target_team: userMap.get(roster.owner_id) || `Team ${roster.roster_id}`,
                roster_id: roster.roster_id,
                give_players: [myPlayer],
                receive_players: [theirPlayer],
                value_difference: theirPlayer.value - myPlayer.value,
                fairness_score: fairness,
                match_score: matchScore,
                reasoning: generateTradeReasoning(myPlayer, theirPlayer, userAnalysis, theirAnalysis)
              });
            }
          }
        }
      }

      setProposals(tradeSuggestions
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 20)
      );
    } catch (error) {
      console.error('Error finding trades:', error);
    }
    setLoading(false);
  };

  const generateTradeReasoning = (give: any, receive: any, yourAnalysis: any, theirAnalysis: any) => {
    const reasons = [];
    const valueDiff = Math.abs(receive.value - give.value);

    if (yourAnalysis.needs.includes(receive.position)) {
      reasons.push(`Fills your ${receive.position} need`);
    }

    if (theirAnalysis.needs.includes(give.position)) {
      reasons.push(`Addresses their ${give.position} weakness`);
    }

    if (yourAnalysis.surpluses.includes(give.position)) {
      reasons.push(`Trade from your ${give.position} surplus`);
    }

    if (theirAnalysis.surpluses.includes(receive.position)) {
      reasons.push(`Acquire from their ${receive.position} depth`);
    }

    if (valueDiff < 5.0) {
      reasons.push('Excellent value match');
    } else if (valueDiff < 15.0) {
      reasons.push('Fair value trade');
    }

    if (receive.value > give.value) {
      reasons.push(`Gain ${(receive.value - give.value).toFixed(1)} value`);
    } else if (give.value > receive.value) {
      reasons.push(`Upgrade at position despite slight value loss`);
    }

    return reasons.length > 0 ? reasons.join('. ') + '.' : 'Mutually beneficial trade.';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 text-fdp-text-1 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ArrowLeftRight className="w-8 h-8 text-fdp-accent-1" />
          <h1 className="text-3xl font-bold">Trade Finder</h1>
        </div>

        <div className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fdp-text-2 mb-2">
                Select Your Team
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
                  onClick={findTrades}
                  disabled={loading || !selectedTeam}
                  className="px-6 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg flex items-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  {loading ? 'Analyzing...' : 'Find Trades'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-fdp-accent-1 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-fdp-text-3">Analyzing trade opportunities...</p>
          </div>
        ) : !selectedTeam ? (
          <div className="text-center py-12 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
            <Users className="w-16 h-16 text-fdp-border-1 mx-auto mb-4" />
            <p className="text-fdp-text-3">Select a team to find trade opportunities</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 bg-fdp-surface-1 rounded-lg border border-fdp-border-1">
            <Search className="w-16 h-16 text-fdp-border-1 mx-auto mb-4" />
            <p className="text-fdp-text-3">No trade opportunities found</p>
            <p className="text-sm text-fdp-text-3 mt-2">Try adjusting your team or check back later</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, index) => (
              <div
                key={index}
                className="bg-fdp-surface-1 backdrop-blur-sm rounded-lg border border-fdp-border-1 p-6 hover:border-fdp-accent-1 transition hover-lift card-enter"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="w-5 h-5 text-fdp-accent-1" />
                    Trade with {proposal.target_team}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-fdp-pos" />
                      <span className="text-fdp-pos font-semibold">
                        {proposal.match_score.toFixed(0)}% Match
                      </span>
                    </div>
                    <div className="text-sm text-fdp-text-3">
                      {proposal.fairness_score.toFixed(0)}% Fair
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-fdp-neg/10 border border-fdp-neg/30 rounded-lg p-4">
                    <p className="text-sm text-fdp-text-3 mb-3 font-semibold">You Give</p>
                    {proposal.give_players.map(player => (
                      <div key={player.id} className="mb-3 flex items-center gap-3">
                        <PlayerAvatar
                          playerId={player.id}
                          playerName={player.name}
                          team=""
                          position={player.position}
                          size="md"
                          showTeamLogo={true}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-fdp-neg font-semibold">Value: {player.value.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-fdp-pos/10 border border-fdp-pos/30 rounded-lg p-4">
                    <p className="text-sm text-fdp-text-3 mb-3 font-semibold">You Receive</p>
                    {proposal.receive_players.map(player => (
                      <div key={player.id} className="mb-3 flex items-center gap-3">
                        <PlayerAvatar
                          playerId={player.id}
                          playerName={player.name}
                          team=""
                          position={player.position}
                          size="md"
                          showTeamLogo={true}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-fdp-pos font-semibold">Value: {player.value.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-fdp-surface-2 rounded-lg">
                  <p className="text-sm text-fdp-text-2">{proposal.reasoning}</p>
                  {proposal.value_difference !== 0 && (
                    <p className={`text-sm mt-2 font-semibold ${proposal.value_difference > 0 ? 'text-fdp-pos' : 'text-fdp-neg'}`}>
                      Net value: {proposal.value_difference > 0 ? '+' : ''}{proposal.value_difference.toFixed(1)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
