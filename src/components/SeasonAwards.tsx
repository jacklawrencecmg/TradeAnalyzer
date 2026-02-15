import { useState, useEffect } from 'react';
import { Trophy, Award, TrendingUp, Star, Target, Zap, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SeasonAward {
  id: string;
  league_id: string;
  season: number;
  award: string;
  roster_id: number | null;
  team_name: string | null;
  user_id: string | null;
  details: string;
  stats: any;
  created_at: string;
}

interface SeasonAwardsProps {
  leagueId: string;
  season?: number;
}

export function SeasonAwards({ leagueId, season = 2025 }: SeasonAwardsProps) {
  const [awards, setAwards] = useState<SeasonAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAwards();
  }, [leagueId, season]);

  const loadAwards = async () => {
    try {
      const { data, error } = await supabase
        .from('season_awards')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season', season)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAwards(data || []);
    } catch (error) {
      console.error('Error loading awards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAwardIcon = (awardName: string) => {
    switch (awardName) {
      case 'Best GM':
        return <Crown className="w-8 h-8 text-yellow-500" />;
      case 'Most Consistent':
        return <Target className="w-8 h-8 text-blue-500" />;
      case 'Dynasty Builder':
        return <TrendingUp className="w-8 h-8 text-green-500" />;
      case 'Biggest Riser':
        return <Zap className="w-8 h-8 text-purple-500" />;
      case 'Trade King':
        return <Star className="w-8 h-8 text-orange-500" />;
      default:
        return <Award className="w-8 h-8 text-gray-500" />;
    }
  };

  const getAwardColor = (awardName: string) => {
    switch (awardName) {
      case 'Best GM':
        return 'from-yellow-50 to-yellow-100 border-yellow-300';
      case 'Most Consistent':
        return 'from-blue-50 to-blue-100 border-blue-300';
      case 'Dynasty Builder':
        return 'from-green-50 to-green-100 border-green-300';
      case 'Biggest Riser':
        return 'from-purple-50 to-purple-100 border-purple-300';
      case 'Trade King':
        return 'from-orange-50 to-orange-100 border-orange-300';
      default:
        return 'from-gray-50 to-gray-100 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (awards.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Awards Yet</h3>
        <p className="text-gray-600">
          Season awards will be generated after the season ends
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-8 h-8 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-900">{season} Season Awards</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {awards.map((award) => (
          <div
            key={award.id}
            className={`bg-gradient-to-br ${getAwardColor(award.award)} border-2 rounded-xl p-6 transition-all hover:shadow-lg`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {getAwardIcon(award.award)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {award.award}
                </h3>
                <p className="text-xl font-semibold text-gray-800 mb-2">
                  {award.team_name || 'Unknown Team'}
                </p>
                <p className="text-sm text-gray-700 mb-3">
                  {award.details}
                </p>
                {award.stats && Object.keys(award.stats).length > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    {Object.entries(award.stats).map(([key, value]) => (
                      <div
                        key={key}
                        className="px-2 py-1 bg-white/60 rounded-full font-medium"
                      >
                        <span className="text-gray-600">{formatStatKey(key)}:</span>{' '}
                        <span className="text-gray-900">{formatStatValue(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatStatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatStatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toFixed(1);
  }
  return String(value);
}
