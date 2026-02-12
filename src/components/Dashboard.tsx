import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, UserLeague } from '../lib/supabase';
import { LogOut, Plus, Settings, TrendingUp, Users } from 'lucide-react';
import { LeagueManager } from './LeagueManager';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [currentLeague, setCurrentLeague] = useState<UserLeague | null>(null);
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [showManageLeagues, setShowManageLeagues] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadLeagues();
    }
  }, [user]);

  const loadLeagues = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_leagues')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeagues(data || []);
      if (data && data.length > 0 && !currentLeague) {
        setCurrentLeague(data[0]);
      }
    } catch (error) {
      console.error('Error loading leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeague = async (leagueId: string, leagueName: string, teamName: string, isSuperflex: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('user_leagues').insert({
        user_id: user.id,
        league_id: leagueId,
        league_name: leagueName || `League ${leagueId}`,
        team_name: teamName,
        is_superflex: isSuperflex,
        is_active: true,
      });

      if (error) throw error;

      await loadLeagues();
      setShowAddLeague(false);
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        alert('This league is already saved to your account.');
      } else {
        console.error('Error adding league:', error);
        alert('Failed to add league. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
        <div className="text-fdp-text-1 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-fdp-surface-1 to-fdp-bg-1 border-b border-fdp-border-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-fdp-text-1">Fantasy Draft Pros</h1>
              <p className="text-fdp-text-3 text-sm">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 bg-fdp-neg hover:bg-opacity-90 text-white rounded-lg transition-all transform hover:-translate-y-0.5"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* League Selector */}
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-fdp-text-1 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Leagues
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddLeague(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Add League
              </button>
              <button
                onClick={() => setShowManageLeagues(true)}
                className="flex items-center gap-2 px-4 py-2 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 rounded-lg transition-all transform hover:-translate-y-0.5"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            </div>
          </div>

          {leagues.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-fdp-text-3 mb-4">No leagues saved yet. Add your first league to get started!</p>
              <button
                onClick={() => setShowAddLeague(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Add Your First League
              </button>
            </div>
          ) : (
            <div>
              <select
                value={currentLeague?.id || ''}
                onChange={(e) => {
                  const league = leagues.find(l => l.id === e.target.value);
                  setCurrentLeague(league || null);
                }}
                className="w-full px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none text-lg font-medium"
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.league_name} ({league.league_id})
                  </option>
                ))}
              </select>

              {currentLeague && (
                <div className="mt-4 flex gap-4 text-sm text-fdp-text-3">
                  {currentLeague.team_name && (
                    <span className="font-medium">Team: {currentLeague.team_name}</span>
                  )}
                  {currentLeague.is_superflex && (
                    <span className="px-2 py-1 bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2 rounded-full text-xs font-semibold">
                      Superflex
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        {currentLeague && (
          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-fdp-accent-1" />
              Trade Analysis
            </h2>

            <div className="text-center py-12">
              <p className="text-fdp-text-2 text-lg mb-4">
                Trade analysis features coming soon!
              </p>
              <p className="text-fdp-text-3">
                Connect to Sleeper API to analyze trades for {currentLeague.league_name}
              </p>
            </div>
          </div>
        )}

        {/* Modals */}
        {showAddLeague && (
          <AddLeagueModal
            onClose={() => setShowAddLeague(false)}
            onAdd={handleAddLeague}
          />
        )}

        {showManageLeagues && (
          <LeagueManager
            leagues={leagues}
            onClose={() => setShowManageLeagues(false)}
            onUpdate={loadLeagues}
          />
        )}
      </div>
    </div>
  );
}

interface AddLeagueModalProps {
  onClose: () => void;
  onAdd: (leagueId: string, leagueName: string, teamName: string, isSuperflex: boolean) => void;
}

function AddLeagueModal({ onClose, onAdd }: AddLeagueModalProps) {
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isSuperflex, setIsSuperflex] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueId.trim()) {
      alert('Please enter a League ID');
      return;
    }
    onAdd(leagueId.trim(), leagueName.trim(), teamName.trim(), isSuperflex);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-fdp-text-1 mb-4">Add New League</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              Sleeper League ID *
            </label>
            <input
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="e.g., 123456789"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              League Name (optional)
            </label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="My Dynasty League"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              Your Team Name (optional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="My Team"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSuperflex"
              checked={isSuperflex}
              onChange={(e) => setIsSuperflex(e.target.checked)}
              className="w-4 h-4 text-fdp-accent-1 border-fdp-border-1 rounded focus:ring-fdp-accent-1"
            />
            <label htmlFor="isSuperflex" className="text-sm font-medium text-fdp-text-2">
              Superflex League?
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              Add League
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 font-semibold py-2 px-4 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
