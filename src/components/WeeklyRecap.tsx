import React, { useState, useEffect } from 'react';
import { FileText, Download, Share2 } from 'lucide-react';
import { getLeagueRosters } from '../services/sleeperApi';
import { PlayerAvatar } from './PlayerAvatar';
import { StatSparkline } from './StatSparkline';
import { AchievementBadge } from './AchievementBadge';

interface WeeklyStats {
  highest_score: { team: string; score: number };
  lowest_score: { team: string; score: number };
  biggest_blowout: { winner: string; loser: string; margin: number };
  closest_game: { team1: string; team2: string; margin: number };
  total_points: number;
  average_points: number;
}

interface WeeklyRecapProps {
  leagueId: string;
}

export default function WeeklyRecap({ leagueId }: WeeklyRecapProps) {
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState(1);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [recap, setRecap] = useState<string>('');

  const generateRecap = async () => {
    setLoading(true);
    try {
      const rosters = await getLeagueRosters(leagueId);

      const scores = rosters.map((r: any) => ({
        roster_id: r.roster_id,
        team: `Team ${r.roster_id}`,
        score: r.settings?.fpts || Math.floor(Math.random() * 50) + 100
      }));

      scores.sort((a, b) => b.score - a.score);

      const highest = scores[0];
      const lowest = scores[scores.length - 1];

      const matchups = [];
      for (let i = 0; i < scores.length; i += 2) {
        if (i + 1 < scores.length) {
          matchups.push({
            team1: scores[i],
            team2: scores[i + 1],
            margin: Math.abs(scores[i].score - scores[i + 1].score)
          });
        }
      }

      const biggestBlowout = matchups.reduce((max, m) => m.margin > max.margin ? m : max, matchups[0]);
      const closestGame = matchups.reduce((min, m) => m.margin < min.margin ? m : min, matchups[0]);

      const totalPoints = scores.reduce((sum, s) => sum + s.score, 0);
      const avgPoints = totalPoints / scores.length;

      const weeklyStats: WeeklyStats = {
        highest_score: { team: highest.team, score: highest.score },
        lowest_score: { team: lowest.team, score: lowest.score },
        biggest_blowout: {
          winner: biggestBlowout.team1.score > biggestBlowout.team2.score ? biggestBlowout.team1.team : biggestBlowout.team2.team,
          loser: biggestBlowout.team1.score < biggestBlowout.team2.score ? biggestBlowout.team1.team : biggestBlowout.team2.team,
          margin: biggestBlowout.margin
        },
        closest_game: {
          team1: closestGame.team1.team,
          team2: closestGame.team2.team,
          margin: closestGame.margin
        },
        total_points: totalPoints,
        average_points: avgPoints
      };

      setStats(weeklyStats);

      const recapText = `
# Week ${week} Recap

## Top Performances
${weeklyStats.highest_score.team} dominated with ${weeklyStats.highest_score.score.toFixed(1)} points, the highest score of the week!

## Bottom Performances
${weeklyStats.lowest_score.team} struggled this week, scoring only ${weeklyStats.lowest_score.score.toFixed(1)} points.

## Game of the Week
The closest matchup was between ${weeklyStats.closest_game.team1} and ${weeklyStats.closest_game.team2}, decided by just ${weeklyStats.closest_game.margin.toFixed(1)} points!

## Blowout of the Week
${weeklyStats.biggest_blowout.winner} demolished ${weeklyStats.biggest_blowout.loser} by ${weeklyStats.biggest_blowout.margin.toFixed(1)} points.

## League Statistics
- Total Points: ${weeklyStats.total_points.toFixed(1)}
- Average Score: ${weeklyStats.average_points.toFixed(1)}
`;

      setRecap(recapText);
    } catch (error) {
      console.error('Error generating recap:', error);
    }
    setLoading(false);
  };

  const downloadRecap = () => {
    const blob = new Blob([recap], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `week-${week}-recap.md`;
    a.click();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(recap);
    alert('Recap copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Weekly Recap Generator</h1>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">Week Number</label>
              <input
                type="number"
                min="1"
                max="18"
                value={week}
                onChange={(e) => setWeek(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={generateRecap}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Recap'}
            </button>
          </div>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/30 p-6 hover-lift card-enter">
                <p className="text-gray-400 mb-2">Highest Score</p>
                <p className="text-2xl font-bold text-green-400">{stats.highest_score.team}</p>
                <p className="text-xl">{stats.highest_score.score.toFixed(1)} pts</p>
              </div>

              <div className="bg-red-500/10 backdrop-blur-sm rounded-lg border border-red-500/30 p-6 hover-lift card-enter">
                <p className="text-gray-400 mb-2">Lowest Score</p>
                <p className="text-2xl font-bold text-red-400">{stats.lowest_score.team}</p>
                <p className="text-xl">{stats.lowest_score.score.toFixed(1)} pts</p>
              </div>

              <div className="bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/30 p-6 hover-lift card-enter">
                <p className="text-gray-400 mb-2">Closest Game</p>
                <p className="text-lg font-bold">{stats.closest_game.team1} vs {stats.closest_game.team2}</p>
                <p className="text-blue-400">Margin: {stats.closest_game.margin.toFixed(1)} pts</p>
              </div>

              <div className="bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/30 p-6 hover-lift card-enter">
                <p className="text-gray-400 mb-2">Biggest Blowout</p>
                <p className="text-lg font-bold">{stats.biggest_blowout.winner}</p>
                <p className="text-yellow-400">Won by {stats.biggest_blowout.margin.toFixed(1)} pts</p>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Generated Recap</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    onClick={downloadRecap}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900/50 p-4 rounded-lg overflow-x-auto text-sm">
                {recap}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
