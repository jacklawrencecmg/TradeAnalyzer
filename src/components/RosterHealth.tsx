import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Calendar, Info } from 'lucide-react';
import { getLeagueRosters } from '../services/sleeperApi';
import { sportsDataAPI } from '../services/sportsdataApi';
import Tooltip from './Tooltip';

interface PlayerHealth {
  player_id: string;
  name: string;
  position: string;
  team: string;
  status: 'Healthy' | 'Questionable' | 'Doubtful' | 'Out' | 'IR';
  injury_notes: string;
  bye_week: number;
  injury_body_part?: string;
  sportsdata_injury_notes?: string;
}

interface RosterHealthProps {
  leagueId: string;
  rosterId: string;
}

export default function RosterHealth({ leagueId, rosterId }: RosterHealthProps) {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerHealth[]>([]);
  const [week, setWeek] = useState(1);

  useEffect(() => {
    loadRosterHealth();
  }, [leagueId, rosterId]);

  const loadRosterHealth = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);
      const userRoster = rosters.find((r: any) => r.roster_id.toString() === rosterId);

      if (!userRoster) {
        setLoading(false);
        return;
      }

      const [allPlayers, sportsDataInjuries] = await Promise.all([
        fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json()),
        sportsDataAPI.getInjuries().catch(() => [])
      ]);

      const healthData: PlayerHealth[] = (userRoster.players || []).map((playerId: string) => {
        const player = allPlayers[playerId];
        if (!player) return null;

        const playerName = player.full_name || `${player.first_name} ${player.last_name}`;
        const sportsDataInjury = sportsDataInjuries.find(
          (inj: any) => inj.Name?.toLowerCase() === playerName.toLowerCase()
        );

        let status: PlayerHealth['status'] = 'Healthy';
        const injuryStatus = sportsDataInjury?.Status || player.injury_status;
        if (injuryStatus?.toLowerCase().includes('out') || injuryStatus?.toLowerCase() === 'ir') status = 'Out';
        else if (injuryStatus?.toLowerCase().includes('doubtful')) status = 'Doubtful';
        else if (injuryStatus?.toLowerCase().includes('questionable')) status = 'Questionable';
        else if (injuryStatus?.toLowerCase() === 'ir') status = 'IR';

        return {
          player_id: playerId,
          name: playerName,
          position: player.position,
          team: player.team || 'FA',
          status,
          injury_notes: player.injury_notes || '',
          bye_week: player.bye_week || 0,
          injury_body_part: sportsDataInjury?.InjuryBodyPart,
          sportsdata_injury_notes: sportsDataInjury?.InjuryNotes
        };
      }).filter((p): p is PlayerHealth => p !== null);

      setPlayers(healthData);
    } catch (error) {
      console.error('Error loading roster health:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Questionable': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Doubtful': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Out':
      case 'IR': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Healthy': return <CheckCircle className="w-5 h-5" />;
      case 'Questionable':
      case 'Doubtful': return <AlertTriangle className="w-5 h-5" />;
      case 'Out':
      case 'IR': return <Activity className="w-5 h-5" />;
      default: return null;
    }
  };

  const healthyCount = players.filter(p => p.status === 'Healthy').length;
  const injuredCount = players.filter(p => p.status !== 'Healthy').length;
  const byeWeekCount = players.filter(p => p.bye_week === week).length;

  const positionCounts = players.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Activity className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Roster Health Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <p className="text-gray-400">Healthy</p>
            </div>
            <p className="text-3xl font-bold text-green-400">{healthyCount}</p>
          </div>
          <div className="bg-red-500/10 backdrop-blur-sm rounded-lg border border-red-500/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <p className="text-gray-400">Injured</p>
            </div>
            <p className="text-3xl font-bold text-red-400">{injuredCount}</p>
          </div>
          <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-6 h-6 text-blue-400" />
              <p className="text-gray-400">On Bye (Week {week})</p>
            </div>
            <p className="text-3xl font-bold text-blue-400">{byeWeekCount}</p>
          </div>
          <div className="bg-gray-500/10 backdrop-blur-sm rounded-lg border border-gray-500/30 p-6">
            <p className="text-gray-400 mb-2">Roster Size</p>
            <p className="text-3xl font-bold">{players.length}</p>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Position Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(positionCounts).map(([pos, count]) => (
              <div key={pos} className="text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-sm text-gray-400">{pos}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Check Bye Week</label>
          <input
            type="number"
            min="1"
            max="18"
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value) || 1)}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading roster health...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map(player => (
              <div
                key={player.player_id}
                className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 hover:border-blue-500 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold">{player.name}</h3>
                      <span className="text-sm text-gray-400">{player.position} - {player.team}</span>
                      {(player.injury_body_part || player.sportsdata_injury_notes) && (
                        <Tooltip content={
                          <div className="space-y-2 text-xs">
                            {player.injury_body_part && (
                              <div>
                                <div className="font-semibold text-orange-400">Injury Details</div>
                                <div>Body Part: {player.injury_body_part}</div>
                              </div>
                            )}
                            {player.sportsdata_injury_notes && (
                              <div>
                                <div className="font-semibold text-orange-400">Notes</div>
                                <div className="text-gray-400">{player.sportsdata_injury_notes}</div>
                              </div>
                            )}
                            <div className="text-gray-400 text-xs pt-2 border-t border-gray-600">
                              Data from SportsData.io
                            </div>
                          </div>
                        }>
                          <Info className="w-4 h-4 text-blue-400 cursor-help" />
                        </Tooltip>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(player.status)}`}>
                        {getStatusIcon(player.status)}
                        <span className="text-sm font-semibold">{player.status}</span>
                      </div>

                      {player.bye_week === week && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm font-semibold">Bye Week</span>
                        </div>
                      )}

                      {(player.injury_notes || player.sportsdata_injury_notes) && (
                        <p className="text-sm text-gray-400 italic">
                          {player.sportsdata_injury_notes || player.injury_notes}
                        </p>
                      )}
                    </div>
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
