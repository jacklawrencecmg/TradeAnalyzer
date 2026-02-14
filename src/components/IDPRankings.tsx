import { useState, useEffect } from 'react';
import { Shield, TrendingUp, Users, Search, Settings } from 'lucide-react';
import { getIDPPositionLabel, getSubPositionLabel, getAllIDPPositions, type IDPPosition } from '../lib/idp/idpMultipliers';
import { getIDPValueTier } from '../lib/idp/calculateIDPValue';
import { getIdpPreset, getPresetLabel, getPresetDescription, getPresetIcon, getPresetColor, getFormatWithPreset, type IDPScoringPreset } from '../lib/idp/getIdpPreset';
import { getPresetImpact } from '../lib/fdp/idpPresetMultipliers';
import { ListSkeleton } from './LoadingSkeleton';
import { PlayerAvatar } from './PlayerAvatar';

interface IDPPlayer {
  player_id: string;
  full_name: string;
  position: IDPPosition;
  team?: string;
  position_rank: number;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
  fdp_rank: number;
}

export default function IDPRankings() {
  const [position, setPosition] = useState<IDPPosition>('LB');
  const [baseFormat, setBaseFormat] = useState<'dynasty_sf_idp' | 'dynasty_1qb_idp'>('dynasty_sf_idp');
  const [scoringPreset, setScoringPreset] = useState<IDPScoringPreset>('balanced');
  const [players, setPlayers] = useState<IDPPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const format = getFormatWithPreset(baseFormat, scoringPreset);

  useEffect(() => {
    fetchRankings();
  }, [position, format]);

  const fetchRankings = async () => {
    try {
      setLoading(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/idp-rankings?position=${position}&format=${format}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch rankings');

      const result = await response.json();
      setPlayers(result.players || []);
    } catch (err) {
      console.error('Error fetching IDP rankings:', err);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.team?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPositionIcon = (pos: IDPPosition) => {
    if (pos === 'DL') return '🛡️';
    if (pos === 'LB') return '⚔️';
    if (pos === 'DB') return '🎯';
    return '🏈';
  };

  const getPositionColor = (pos: IDPPosition) => {
    if (pos === 'DL') return 'bg-red-100 text-red-800 border-red-200';
    if (pos === 'LB') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (pos === 'DB') return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return <ListSkeleton count={20} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">IDP Rankings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Individual Defensive Player rankings with FDP values
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                value={baseFormat}
                onChange={(e) => setBaseFormat(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="dynasty_sf_idp">Dynasty Superflex + IDP</option>
                <option value="dynasty_1qb_idp">Dynasty 1QB + IDP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scoring System
              </label>
              <select
                value={scoringPreset}
                onChange={(e) => setScoringPreset(e.target.value as IDPScoringPreset)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ borderLeft: `4px solid ${getPresetColor(scoringPreset)}` }}
              >
                <option value="tackle_heavy">{getPresetIcon('tackle_heavy')} Tackle Heavy</option>
                <option value="balanced">{getPresetIcon('balanced')} Balanced</option>
                <option value="big_play">{getPresetIcon('big_play')} Big Play</option>
              </select>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">Current Preset:</span> {getPresetLabel(scoringPreset)}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {getPresetDescription(scoringPreset)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {getAllIDPPositions().map(pos => {
                const impact = getPresetImpact(pos, scoringPreset);
                return (
                  <div key={pos} className="bg-white rounded p-2 border border-gray-200">
                    <div className="text-xs font-semibold text-gray-700">{pos}</div>
                    <div
                      className={`text-sm font-bold ${
                        impact.change > 0 ? 'text-green-600' : impact.change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}
                    >
                      {impact.change > 0 ? '+' : ''}{impact.change}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{impact.multiplier.toFixed(2)}x</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-6 text-white">
        <div className="flex items-center gap-4 mb-4">
          {getAllIDPPositions().map(pos => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                position === pos
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="text-xl">{getPositionIcon(pos)}</span>
              {getIDPPositionLabel(pos)}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by player name or team..."
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Players Found</h3>
          <p className="text-gray-600">
            {searchTerm
              ? 'No players match your search criteria'
              : 'No IDP rankings available. Upload player data to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Player
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Position
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Team
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    FDP Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    KTC Value
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Tier
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPlayers.map((player, index) => {
                  const tier = getIDPValueTier(player.fdp_value);
                  return (
                    <tr key={player.player_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            playerId={player.player_id}
                            playerName={player.full_name}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-gray-900">
                              {player.full_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{player.position_rank} {getIDPPositionLabel(player.position)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold border ${getPositionColor(player.position)}`}>
                            {player.position}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-center text-sm font-semibold text-gray-700">
                          {player.team || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-right">
                          <div className="text-lg font-bold" style={{ color: tier.color }}>
                            {player.fdp_value.toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-right text-sm text-gray-600">
                          {player.ktc_value.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <span
                            className="inline-flex px-2 py-1 rounded text-xs font-semibold"
                            style={{
                              backgroundColor: `${tier.color}20`,
                              color: tier.color,
                            }}
                          >
                            {tier.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" />
          About IDP Rankings & Scoring Presets
        </h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <strong>FDP Value:</strong> FantasyDraftPros value calculated with IDP-specific multipliers, context adjustments, and scoring preset modifiers
          </p>
          <p>
            <strong>Position Groups:</strong> DL (Defensive Line), LB (Linebacker), DB (Defensive Back)
          </p>
          <p>
            <strong>Scoring Presets:</strong>
          </p>
          <ul className="ml-6 space-y-1">
            <li><span className="font-semibold">Tackle Heavy ({getPresetIcon('tackle_heavy')}):</span> LB +30%, DL -5%, DB +5% - Best for leagues with 1pt/tackle</li>
            <li><span className="font-semibold">Balanced ({getPresetIcon('balanced')}):</span> LB +15%, DL +5%, DB ±0% - Standard IDP scoring</li>
            <li><span className="font-semibold">Big Play ({getPresetIcon('big_play')}):</span> LB -5%, DL +25%, DB -10% - Best for heavy sack/INT bonuses</li>
          </ul>
          <p>
            <strong>Tiers:</strong> Elite (4000+), Strong Starter (3000+), Solid Starter (2000+), Flex (1000+), Depth (500+)
          </p>
          <p className="text-xs text-blue-700 mt-2">
            💡 <strong>Tip:</strong> Use the settings panel to toggle between presets and see how your league's scoring affects player values!
          </p>
        </div>
      </div>
    </div>
  );
}
