import React, { useState } from 'react';
import { Search, Users, ChevronRight, AlertCircle, Loader } from 'lucide-react';
import { SEASON_CONTEXT } from '../config/seasonContext';

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  status: string;
}

interface SleeperImportProps {
  onLeagueSelected: (leagueId: string, leagueName: string) => void;
}

export default function SleeperImport({ onLeagueSelected }: SleeperImportProps) {
  const [step, setStep] = useState<'username' | 'leagues'>('username');
  const [username, setUsername] = useState('');
  const [leagues, setLeagues] = useState<SleeperLeague[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError('Please enter a Sleeper username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${username.trim()}`);

      if (!userRes.ok) {
        setError('Sleeper user not found. Please check the username.');
        setLoading(false);
        return;
      }

      const userData = await userRes.json();
      const userId = userData.user_id;

      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${SEASON_CONTEXT.league_year}`);

      if (!leaguesRes.ok) {
        setError('Failed to fetch leagues');
        setLoading(false);
        return;
      }

      const leaguesData = await leaguesRes.json();

      const formattedLeagues = leaguesData.map((league: any) => ({
        league_id: league.league_id,
        name: league.name,
        season: league.season,
        total_rosters: league.total_rosters,
        status: league.status,
      }));

      setLeagues(formattedLeagues);
      setStep('leagues');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leagues');
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = (league: SleeperLeague) => {
    onLeagueSelected(league.league_id, league.name);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {step === 'username' ? (
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <Users className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-2">Import Sleeper League</h2>
            <p className="text-fdp-text-3">
              Enter your Sleeper username to view and analyze your dynasty leagues
            </p>
          </div>

          <form onSubmit={handleUsernameSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-fdp-text-2 mb-2">
                Sleeper Username
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fdp-text-3 w-5 h-5 pointer-events-none" />
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your Sleeper username"
                  className="w-full pl-10 pr-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none transition-all"
                  disabled={loading}
                />
              </div>
              <p className="mt-2 text-sm text-fdp-text-3">
                Your Sleeper username (not email). No authentication required.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-fdp-neg bg-opacity-10 border border-fdp-neg rounded-lg">
                <AlertCircle className="w-5 h-5 text-fdp-neg flex-shrink-0" />
                <p className="text-sm text-fdp-neg">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Loading Leagues...
                </>
              ) : (
                <>
                  Find My Leagues
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-fdp-border-1">
            <h3 className="font-semibold text-fdp-text-1 mb-3">How it works:</h3>
            <ol className="space-y-2 text-sm text-fdp-text-3">
              <li className="flex items-start gap-2">
                <span className="font-bold text-fdp-accent-1">1.</span>
                <span>Enter your Sleeper username</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-fdp-accent-1">2.</span>
                <span>Select which league to analyze</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-fdp-accent-1">3.</span>
                <span>View power rankings, roster values, and trade suggestions</span>
              </li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-md p-8">
          <div className="mb-6">
            <button
              onClick={() => {
                setStep('username');
                setLeagues([]);
                setError(null);
              }}
              className="text-fdp-accent-1 hover:text-fdp-accent-2 text-sm font-medium transition-colors"
            >
              ← Back to username
            </button>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-2">Select a League</h2>
            <p className="text-fdp-text-3">
              Found {leagues.length} league{leagues.length !== 1 ? 's' : ''} for @{username}
            </p>
          </div>

          {leagues.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-fdp-text-3 mx-auto mb-4" />
              <p className="text-fdp-text-3">No leagues found for the 2024 season</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leagues.map((league) => (
                <button
                  key={league.league_id}
                  onClick={() => handleLeagueSelect(league)}
                  type="button"
                  className="w-full flex items-center justify-between p-4 bg-fdp-surface-2 hover:bg-fdp-border-1 border border-fdp-border-1 hover:border-fdp-accent-1 rounded-lg transition-all group cursor-pointer"
                >
                  <div className="text-left">
                    <h3 className="font-semibold text-fdp-text-1 group-hover:text-fdp-accent-1 mb-1">
                      {league.name}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-fdp-text-3">
                      <span>{league.total_rosters} teams</span>
                      <span className="capitalize">{league.status}</span>
                      <span>Season {league.season}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-fdp-text-3 group-hover:text-fdp-accent-1 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
