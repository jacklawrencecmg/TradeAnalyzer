import { useState, useEffect } from 'react';
import { Search, Save, X, CheckCircle, AlertTriangle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PlayerAvatar } from './PlayerAvatar';

interface PlayerIdentity {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  sleeper_id: string | null;
  espn_id: string | null;
  gsis_id: string | null;
  headshot_url: string | null;
}

interface PlayerHeadshot {
  player_id: string;
  headshot_url: string;
  source: string;
  confidence: number;
  is_override: boolean;
  verified_at: string | null;
  updated_at: string;
}

export default function HeadshotAdmin() {
  const [searchTerm, setSearchTerm] = useState('');
  const [players, setPlayers] = useState<(PlayerIdentity & { canonical_headshot?: PlayerHeadshot })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerIdentity | null>(null);
  const [editingUrl, setEditingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPlayers();
    } else {
      setPlayers([]);
    }
  }, [searchTerm]);

  const searchPlayers = async () => {
    try {
      setLoading(true);

      const { data: identities, error } = await supabase
        .from('player_identity')
        .select('player_id, full_name, position, team, sleeper_id, espn_id, gsis_id, headshot_url')
        .ilike('full_name', `%${searchTerm}%`)
        .limit(50);

      if (error) throw error;

      const playerIds = (identities || []).map(p => p.player_id);

      const { data: headshots } = await supabase
        .from('player_headshots')
        .select('*')
        .in('player_id', playerIds);

      const headshotMap = new Map(
        (headshots || []).map(h => [h.player_id, h])
      );

      const combined = (identities || []).map(player => ({
        ...player,
        canonical_headshot: headshotMap.get(player.player_id),
      }));

      setPlayers(combined);
    } catch (err) {
      console.error('Error searching players:', err);
      showMessage('error', 'Failed to search players');
    } finally {
      setLoading(false);
    }
  };

  const selectPlayer = (player: PlayerIdentity) => {
    setSelectedPlayer(player);
    const current = players.find(p => p.player_id === player.player_id);
    setEditingUrl(current?.canonical_headshot?.headshot_url || player.headshot_url || '');
  };

  const saveManualOverride = async () => {
    if (!selectedPlayer || !editingUrl) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('player_headshots')
        .upsert({
          player_id: selectedPlayer.player_id,
          headshot_url: editingUrl,
          source: 'manual',
          confidence: 100,
          is_override: true,
          verified_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id',
        });

      if (error) throw error;

      showMessage('success', `Successfully saved headshot for ${selectedPlayer.full_name}`);
      setSelectedPlayer(null);
      setEditingUrl('');

      searchPlayers();
    } catch (err) {
      console.error('Error saving headshot:', err);
      showMessage('error', 'Failed to save headshot');
    } finally {
      setSaving(false);
    }
  };

  const clearOverride = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('player_headshots')
        .update({
          is_override: false,
          confidence: 50,
        })
        .eq('player_id', playerId);

      if (error) throw error;

      showMessage('success', 'Override cleared - will re-sync from external sources');
      searchPlayers();
    } catch (err) {
      console.error('Error clearing override:', err);
      showMessage('error', 'Failed to clear override');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      sleeper: 'bg-purple-100 text-purple-800 border-purple-200',
      espn: 'bg-red-100 text-red-800 border-red-200',
      gsis: 'bg-blue-100 text-blue-800 border-blue-200',
      manual: 'bg-green-100 text-green-800 border-green-200',
      fallback: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[source] || colors.fallback;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Headshot Admin</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manually fix incorrect or missing player headshots
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search for a player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {loading && (
          <div className="mt-4 text-center text-gray-600">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Searching...
          </div>
        )}

        {players.length > 0 && (
          <div className="mt-4 space-y-2">
            {players.map((player) => (
              <div
                key={player.player_id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => selectPlayer(player)}
              >
                <div className="flex items-center gap-4">
                  <PlayerAvatar
                    playerId={player.player_id}
                    playerName={player.full_name}
                    team={player.team || undefined}
                    position={player.position}
                    size="md"
                    headshotUrl={player.canonical_headshot?.headshot_url || player.headshot_url || undefined}
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{player.full_name}</div>
                    <div className="text-sm text-gray-600">
                      {player.position} {player.team && `- ${player.team}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {player.sleeper_id && (
                        <span className="text-xs text-gray-500">Sleeper: {player.sleeper_id}</span>
                      )}
                      {player.espn_id && (
                        <span className="text-xs text-gray-500">ESPN: {player.espn_id}</span>
                      )}
                      {player.gsis_id && (
                        <span className="text-xs text-gray-500">GSIS: {player.gsis_id}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {player.canonical_headshot && (
                    <>
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getSourceBadge(player.canonical_headshot.source)}`}>
                        {player.canonical_headshot.source}
                      </span>
                      <span className="text-xs text-gray-600">
                        {player.canonical_headshot.confidence}%
                      </span>
                      {player.canonical_headshot.is_override && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                          Override
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                Edit Headshot: {selectedPlayer.full_name}
              </h3>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <PlayerAvatar
                    playerId={selectedPlayer.player_id}
                    playerName={selectedPlayer.full_name}
                    team={selectedPlayer.team || undefined}
                    position={selectedPlayer.position}
                    size="xl"
                    headshotUrl={editingUrl || undefined}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700 mb-1">Current Headshot URL</div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600 break-all">
                    {editingUrl || 'No headshot set'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Headshot URL
                </label>
                <input
                  type="url"
                  value={editingUrl}
                  onChange={(e) => setEditingUrl(e.target.value)}
                  placeholder="https://example.com/player-headshot.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ImageIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <div className="font-semibold mb-1">External IDs</div>
                    <div className="space-y-1 text-blue-800">
                      {selectedPlayer.sleeper_id && (
                        <div>Sleeper: <code className="bg-blue-100 px-1 rounded">{selectedPlayer.sleeper_id}</code></div>
                      )}
                      {selectedPlayer.espn_id && (
                        <div>ESPN: <code className="bg-blue-100 px-1 rounded">{selectedPlayer.espn_id}</code></div>
                      )}
                      {selectedPlayer.gsis_id && (
                        <div>GSIS: <code className="bg-blue-100 px-1 rounded">{selectedPlayer.gsis_id}</code></div>
                      )}
                      {!selectedPlayer.sleeper_id && !selectedPlayer.espn_id && !selectedPlayer.gsis_id && (
                        <div className="text-red-600">No external IDs found</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => clearOverride(selectedPlayer.player_id)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear Override & Re-Sync
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedPlayer(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveManualOverride}
                    disabled={saving || !editingUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Manual Override
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
