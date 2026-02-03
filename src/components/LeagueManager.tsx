import { useState } from 'react';
import { supabase, UserLeague } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Trash2, Edit2, X } from 'lucide-react';

interface LeagueManagerProps {
  leagues: UserLeague[];
  onClose: () => void;
  onUpdate: () => void;
}

export function LeagueManager({ leagues, onClose, onUpdate }: LeagueManagerProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    league_name: '',
    team_name: '',
    is_superflex: false,
  });

  const handleDelete = async (leagueId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to remove this league?')) return;

    try {
      const { error } = await supabase
        .from('user_leagues')
        .update({ is_active: false })
        .eq('id', leagueId)
        .eq('user_id', user.id);

      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error deleting league:', error);
      alert('Failed to delete league. Please try again.');
    }
  };

  const handleEdit = (league: UserLeague) => {
    setEditingId(league.id);
    setEditForm({
      league_name: league.league_name,
      team_name: league.team_name || '',
      is_superflex: league.is_superflex,
    });
  };

  const handleUpdate = async (leagueId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_leagues')
        .update(editForm)
        .eq('id', leagueId)
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingId(null);
      onUpdate();
    } catch (error) {
      console.error('Error updating league:', error);
      alert('Failed to update league. Please try again.');
    }
  };

  if (leagues.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Manage Leagues</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-gray-600 text-center py-8">No leagues to manage.</p>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Manage Your Leagues</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {leagues.map((league) => (
            <div
              key={league.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-[#3CBEDC] transition-colors"
            >
              {editingId === league.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.league_name}
                    onChange={(e) => setEditForm({ ...editForm, league_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3CBEDC] focus:border-transparent outline-none"
                    placeholder="League Name"
                  />
                  <input
                    type="text"
                    value={editForm.team_name}
                    onChange={(e) => setEditForm({ ...editForm, team_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3CBEDC] focus:border-transparent outline-none"
                    placeholder="Team Name"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-superflex-${league.id}`}
                      checked={editForm.is_superflex}
                      onChange={(e) => setEditForm({ ...editForm, is_superflex: e.target.checked })}
                      className="w-4 h-4 text-[#3CBEDC] border-gray-300 rounded focus:ring-[#3CBEDC]"
                    />
                    <label htmlFor={`edit-superflex-${league.id}`} className="text-sm font-medium text-gray-700">
                      Superflex League
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(league.id)}
                      className="flex-1 bg-gradient-to-r from-[#3CBEDC] to-[#0694B5] text-white font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-gray-800">{league.league_name}</h4>
                      <p className="text-sm text-gray-600">League ID: {league.league_id}</p>
                      {league.team_name && (
                        <p className="text-sm text-gray-600">Team: {league.team_name}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {league.is_superflex && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            ⚡ Superflex
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Added: {new Date(league.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(league)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(league.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
