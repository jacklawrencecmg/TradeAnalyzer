import React, { useState, useEffect } from 'react';
import { Search, ArrowLeftRight, TrendingUp } from 'lucide-react';
import { getLeagueRosters, getPlayerValueById as getPlayerValue } from '../services/sleeperApi';

interface TradeProposal {
  target_team: string;
  roster_id: number;
  give_players: Array<{ id: string; name: string; value: number; position: string }>;
  receive_players: Array<{ id: string; name: string; value: number; position: string }>;
  value_difference: number;
  fairness_score: number;
  reasoning: string;
}

interface TradeFinderProps {
  leagueId: string;
  rosterId: string;
}

export default function TradeFinder({ leagueId, rosterId }: TradeFinderProps) {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [targetPosition, setTargetPosition] = useState('ALL');

  useEffect(() => {
    findTrades();
  }, [leagueId, rosterId]);

  const findTrades = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const userRoster = rosters.find((r: any) => r.roster_id.toString() === rosterId);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      const allPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());

      const userPlayers = await Promise.all(
        (userRoster.players || []).map(async (pid: string) => {
          const player = allPlayers[pid];
          if (!player) return null;
          return {
            id: pid,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: player.position,
            value: await getPlayerValue(pid)
          };
        })
      );

      const validUserPlayers = userPlayers.filter(p => p !== null);

      const tradeSuggestions: TradeProposal[] = [];

      for (const roster of rosters) {
        if (roster.roster_id.toString() === rosterId) continue;

        const theirPlayers = await Promise.all(
          (roster.players || []).slice(0, 20).map(async (pid: string) => {
            const player = allPlayers[pid];
            if (!player) return null;
            return {
              id: pid,
              name: player.full_name || `${player.first_name} ${player.last_name}`,
              position: player.position,
              value: await getPlayerValue(pid)
            };
          })
        );

        const validTheirPlayers = theirPlayers.filter(p => p !== null);

        for (const theirPlayer of validTheirPlayers) {
          if (!theirPlayer || theirPlayer.value < 500) continue;

          for (const myPlayer of validUserPlayers) {
            if (!myPlayer || myPlayer.value < 500) continue;

            const valueDiff = Math.abs(theirPlayer.value - myPlayer.value);
            if (valueDiff > 2000) continue;

            const fairness = 100 - (valueDiff / Math.max(theirPlayer.value, myPlayer.value)) * 100;

            if (fairness >= 70) {
              tradeSuggestions.push({
                target_team: `Team ${roster.roster_id}`,
                roster_id: roster.roster_id,
                give_players: [myPlayer],
                receive_players: [theirPlayer],
                value_difference: theirPlayer.value - myPlayer.value,
                fairness_score: fairness,
                reasoning: generateTradeReasoning(myPlayer, theirPlayer, valueDiff)
              });
            }
          }
        }
      }

      setProposals(tradeSuggestions.sort((a, b) => b.fairness_score - a.fairness_score).slice(0, 15));
    } catch (error) {
      console.error('Error finding trades:', error);
    }
    setLoading(false);
  };

  const generateTradeReasoning = (give: any, receive: any, diff: number) => {
    const reasons = [];

    if (diff < 500) {
      reasons.push('Excellent value match');
    } else if (diff < 1000) {
      reasons.push('Fair value trade');
    }

    if (give.position !== receive.position) {
      reasons.push(`Position swap: ${give.position} for ${receive.position}`);
    }

    if (receive.value > give.value) {
      reasons.push(`You gain ${(receive.value - give.value).toLocaleString()} in value`);
    }

    return reasons.join('. ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ArrowLeftRight className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Trade Finder</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex gap-4">
            <select
              value={targetPosition}
              onChange={(e) => setTargetPosition(e.target.value)}
              className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
            <button
              onClick={findTrades}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Finding Trades...' : 'Find Trades'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Analyzing trade opportunities...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No fair trade opportunities found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, index) => (
              <div
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 hover:border-blue-500 transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Trade with {proposal.target_team}</h3>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-semibold">
                      {proposal.fairness_score.toFixed(0)}% Fair
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-3">You Give</p>
                    {proposal.give_players.map(player => (
                      <div key={player.id} className="mb-2">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-gray-400">{player.position}</p>
                        <p className="text-sm text-red-400">Value: {player.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-3">You Receive</p>
                    {proposal.receive_players.map(player => (
                      <div key={player.id} className="mb-2">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-gray-400">{player.position}</p>
                        <p className="text-sm text-green-400">Value: {player.value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-700/30 rounded-lg">
                  <p className="text-sm text-gray-300">{proposal.reasoning}</p>
                  {proposal.value_difference !== 0 && (
                    <p className={`text-sm mt-2 ${proposal.value_difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      Net value: {proposal.value_difference > 0 ? '+' : ''}{proposal.value_difference.toLocaleString()}
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
