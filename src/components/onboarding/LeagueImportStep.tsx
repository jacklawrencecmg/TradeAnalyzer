/**
 * League Import Step
 *
 * MOST IMPORTANT: Get league data first
 * Everything else builds from this:
 * - Team analysis
 * - League-aware values
 * - Personalized recommendations
 */

import React, { useState } from 'react';
import { Download, Users, Zap } from 'lucide-react';

export function LeagueImportStep({
  onNext,
  onSkip,
}: {
  onNext: (leagueId: string) => void;
  onSkip: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [platform, setPlatform] = useState<'sleeper' | 'espn' | 'manual' | null>(null);
  const [leagueInput, setLeagueInput] = useState('');

  async function handleImport() {
    if (!platform || !leagueInput) {
      alert('Please select a platform and enter your league ID or URL');
      return;
    }

    setImporting(true);

    try {
      // TODO: Implement actual import
      // For now, simulate import
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock league ID
      const mockLeagueId = `${platform}_${Date.now()}`;

      onNext(mockLeagueId);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import league. Please try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Import Your League</h1>
        <p className="text-xl text-gray-600">
          Everything else builds automatically from this
        </p>
      </div>

      {/* Platform Selection */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          1. Choose Your Platform
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <PlatformButton
            name="Sleeper"
            icon="🏈"
            selected={platform === 'sleeper'}
            onClick={() => setPlatform('sleeper')}
          />

          <PlatformButton
            name="ESPN"
            icon="📺"
            selected={platform === 'espn'}
            onClick={() => setPlatform('espn')}
            disabled
            comingSoon
          />

          <PlatformButton
            name="Manual"
            icon="✏️"
            selected={platform === 'manual'}
            onClick={() => setPlatform('manual')}
            disabled
            comingSoon
          />
        </div>

        {/* Import Input */}
        {platform && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              2. Enter League Information
            </h2>

            {platform === 'sleeper' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sleeper Username or League ID
                  </label>
                  <input
                    type="text"
                    value={leagueInput}
                    onChange={(e) => setLeagueInput(e.target.value)}
                    placeholder="username or league ID"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Find your username in the Sleeper app or paste a league ID
                  </p>
                </div>

                <button
                  onClick={handleImport}
                  disabled={!leagueInput || importing}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Importing League...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Import League
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* What Happens Next */}
      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5" />
          What happens after import:
        </h3>
        <ul className="space-y-2 text-blue-900">
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            Instant team analysis (strengths, weaknesses, strategy)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            League-aware player values (tuned to your scoring)
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            3 personalized actions you should take today
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600">•</span>
            Trade opportunities with your league mates
          </li>
        </ul>
      </div>

      {/* Skip Option */}
      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-gray-600 hover:text-gray-900 underline text-sm"
        >
          Skip for now (you can import later)
        </button>
      </div>
    </div>
  );
}

function PlatformButton({
  name,
  icon,
  selected,
  onClick,
  disabled = false,
  comingSoon = false,
}: {
  name: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative p-6 border-2 rounded-lg transition-all ${
        selected
          ? 'border-blue-600 bg-blue-50'
          : disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <div className="text-4xl mb-2">{icon}</div>
      <div className="font-semibold text-gray-900">{name}</div>

      {comingSoon && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
          Soon
        </div>
      )}

      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm">✓</span>
        </div>
      )}
    </button>
  );
}

export default LeagueImportStep;
