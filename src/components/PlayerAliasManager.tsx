import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, AlertCircle, CheckCircle, XCircle, TestTube } from 'lucide-react';
import {
  resolvePlayerId,
  addManualAlias,
  getPlayerAliases,
  getUnresolvedEntities,
  resolveQuarantinedEntity,
  ignoreQuarantinedEntity,
  testResolver,
} from '../lib/players/resolvePlayerId';
import { supabase } from '../lib/supabase';

interface PlayerAlias {
  id: string;
  alias: string;
  alias_normalized: string;
  source: string;
  created_at: string;
}

interface UnresolvedEntity {
  id: string;
  raw_name: string;
  player_position: string | null;
  team: string | null;
  source: string;
  status: string;
  suggestions: any[];
  created_at: string;
}

export function PlayerAliasManager() {
  const [activeTab, setActiveTab] = useState<'search' | 'aliases' | 'quarantine' | 'test'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerAliases, setPlayerAliases] = useState<PlayerAlias[]>([]);
  const [unresolvedEntities, setUnresolvedEntities] = useState<UnresolvedEntity[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [testName, setTestName] = useState('');
  const [testPosition, setTestPosition] = useState('');
  const [testTeam, setTestTeam] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'quarantine') {
      loadUnresolvedEntities();
    }
  }, [activeTab]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nfl_players')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,search_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (!error && data) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Error searching players:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlayer = async (player: any) => {
    setSelectedPlayer(player);
    setActiveTab('aliases');
    await loadPlayerAliases(player.id);
  };

  const loadPlayerAliases = async (playerId: string) => {
    setLoading(true);
    try {
      const aliases = await getPlayerAliases(playerId);
      setPlayerAliases(aliases);
    } catch (err) {
      console.error('Error loading aliases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async () => {
    if (!selectedPlayer || !newAlias.trim()) return;

    setLoading(true);
    try {
      const success = await addManualAlias(selectedPlayer.id, newAlias, 'admin');

      if (success) {
        setNewAlias('');
        await loadPlayerAliases(selectedPlayer.id);
        alert('Alias added successfully!');
      } else {
        alert('Failed to add alias. It may already exist.');
      }
    } catch (err) {
      console.error('Error adding alias:', err);
      alert('Error adding alias');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm('Are you sure you want to delete this alias?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('player_aliases')
        .delete()
        .eq('id', aliasId);

      if (!error) {
        await loadPlayerAliases(selectedPlayer.id);
      }
    } catch (err) {
      console.error('Error deleting alias:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnresolvedEntities = async () => {
    setLoading(true);
    try {
      const entities = await getUnresolvedEntities('open', 100);
      setUnresolvedEntities(entities);
    } catch (err) {
      console.error('Error loading unresolved entities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEntity = async (entityId: string, playerId: string, createAlias: boolean) => {
    setLoading(true);
    try {
      const success = await resolveQuarantinedEntity(entityId, playerId, createAlias);

      if (success) {
        await loadUnresolvedEntities();
        alert('Entity resolved successfully!');
      } else {
        alert('Failed to resolve entity');
      }
    } catch (err) {
      console.error('Error resolving entity:', err);
      alert('Error resolving entity');
    } finally {
      setLoading(false);
    }
  };

  const handleIgnoreEntity = async (entityId: string) => {
    setLoading(true);
    try {
      const success = await ignoreQuarantinedEntity(entityId);

      if (success) {
        await loadUnresolvedEntities();
      }
    } catch (err) {
      console.error('Error ignoring entity:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestResolver = async () => {
    if (!testName.trim()) return;

    setLoading(true);
    try {
      const result = await testResolver(testName, testPosition || undefined, testTeam || undefined);
      setTestResult(result);
    } catch (err) {
      console.error('Error testing resolver:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'search'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search className="inline w-4 h-4 mr-2" />
              Search Players
            </button>
            <button
              onClick={() => setActiveTab('aliases')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'aliases'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={!selectedPlayer}
            >
              Manage Aliases
            </button>
            <button
              onClick={() => setActiveTab('quarantine')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'quarantine'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertCircle className="inline w-4 h-4 mr-2" />
              Quarantine ({unresolvedEntities.length})
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'test'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TestTube className="inline w-4 h-4 mr-2" />
              Test Resolver
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'search' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Search Players</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by player name..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Search
                </button>
              </div>

              <div className="space-y-2">
                {searchResults.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handleSelectPlayer(player)}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="font-semibold">{player.full_name}</div>
                    <div className="text-sm text-gray-600">
                      {player.player_position} - {player.team || 'FA'} - {player.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'aliases' && selectedPlayer && (
            <div>
              <h2 className="text-xl font-bold mb-4">
                Manage Aliases for {selectedPlayer.full_name}
              </h2>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <strong>Position:</strong> {selectedPlayer.player_position} |{' '}
                  <strong>Team:</strong> {selectedPlayer.team || 'FA'} |{' '}
                  <strong>Status:</strong> {selectedPlayer.status}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Add New Alias</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Enter alias (e.g., Pat Mahomes, P. Mahomes)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddAlias}
                    disabled={loading || !newAlias.trim()}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Plus className="inline w-4 h-4 mr-2" />
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Existing Aliases ({playerAliases.length})</h3>
                <div className="space-y-2">
                  {playerAliases.map((alias) => (
                    <div
                      key={alias.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{alias.alias}</div>
                        <div className="text-sm text-gray-500">
                          Normalized: {alias.alias_normalized} | Source: {alias.source}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAlias(alias.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quarantine' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Unresolved Players Quarantine</h2>
              <p className="text-gray-600 mb-4">
                These player names could not be automatically resolved. Review and match to the correct player.
              </p>

              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : unresolvedEntities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No unresolved entities! Everything is clean.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unresolvedEntities.map((entity) => (
                    <div key={entity.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-lg">{entity.raw_name}</div>
                          <div className="text-sm text-gray-600">
                            Source: {entity.source} | Position: {entity.player_position || 'Unknown'} | Team: {entity.team || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(entity.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleIgnoreEntity(entity.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                          title="Ignore this entity"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      {entity.suggestions && entity.suggestions.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium mb-2">Suggestions:</div>
                          <div className="space-y-2">
                            {entity.suggestions.map((suggestion: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded"
                              >
                                <div>
                                  <div className="font-medium">{suggestion.full_name}</div>
                                  <div className="text-sm text-gray-600">
                                    {suggestion.position} - {suggestion.team || 'FA'} (Score: {suggestion.score})
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleResolveEntity(entity.id, suggestion.player_id, true)
                                    }
                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    Match + Alias
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleResolveEntity(entity.id, suggestion.player_id, false)
                                    }
                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                  >
                                    Match Only
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!entity.suggestions || entity.suggestions.length === 0) && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded text-sm text-yellow-800">
                          No suggestions found. Search for the correct player above and add an alias manually.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'test' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Test Player Resolver</h2>
              <p className="text-gray-600 mb-4">
                Test how the resolver handles different player name variations.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Player Name</label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g., Pat Mahomes, P. Mahomes II"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Position (optional)</label>
                    <input
                      type="text"
                      value={testPosition}
                      onChange={(e) => setTestPosition(e.target.value)}
                      placeholder="e.g., QB, RB, WR"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Team (optional)</label>
                    <input
                      type="text"
                      value={testTeam}
                      onChange={(e) => setTestTeam(e.target.value)}
                      placeholder="e.g., KC, SF, BUF"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTestResolver}
                  disabled={loading || !testName.trim()}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  <TestTube className="inline w-5 h-5 mr-2" />
                  Test Resolver
                </button>
              </div>

              {testResult && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Result:</h3>

                  {testResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Successfully Resolved!</span>
                      </div>

                      {testResult.match && (
                        <div className="p-3 bg-green-50 rounded">
                          <div className="font-medium">{testResult.match.full_name}</div>
                          <div className="text-sm text-gray-600">
                            {testResult.match.player_position} - {testResult.match.team || 'FA'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Match Type: {testResult.match.match_type} | Score: {testResult.match.match_score}
                            {testResult.match.matched_via && ` | Via: ${testResult.match.matched_via}`}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span className="font-medium">Could Not Resolve</span>
                      </div>

                      {testResult.error && (
                        <div className="text-sm text-gray-600">{testResult.error}</div>
                      )}

                      {testResult.suggestions && testResult.suggestions.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">Suggestions:</div>
                          <div className="space-y-2">
                            {testResult.suggestions.map((suggestion: any, idx: number) => (
                              <div key={idx} className="p-2 bg-gray-50 rounded">
                                <div className="font-medium">{suggestion.full_name}</div>
                                <div className="text-sm text-gray-600">
                                  {suggestion.player_position} - {suggestion.team || 'FA'} | Score: {suggestion.match_score}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
