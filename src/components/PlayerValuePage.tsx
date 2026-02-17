import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Users, ArrowRight, Calendar, Award } from 'lucide-react';
import { useParams, Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { generatePlayerMetaTags, parsePlayerSlug, generatePlayerSlug } from '../lib/seo/meta';
import { generatePlayerStructuredData, injectMultipleStructuredData } from '../lib/seo/structuredData';
import { getFDPValue } from '../lib/fdp/getFDPValue';
import ValueChart from './ValueChart';
import { ListSkeleton } from './LoadingSkeleton';

interface PlayerData {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  age?: number;
  fdp_value: number;
  base_value: number;
  dynasty_rank?: number;
  tier?: string;
  value_epoch: string;
  injury_status?: string;
}

interface SimilarPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  fdp_value: number;
  dynasty_rank?: number;
}

interface ValueHistory {
  value: number;
  date: string;
  explanation?: string;
}

export function PlayerValuePage() {
  const { slug } = useParams<{ slug: string }>();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([]);
  const [valueHistory, setValueHistory] = useState<ValueHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;

    loadPlayerData();
  }, [slug]);

  async function loadPlayerData() {
    try {
      setLoading(true);
      setError('');

      const searchName = parsePlayerSlug(slug!);

      const { data: playerData, error: playerError } = await supabase
        .rpc('get_latest_player_values', {})
        .ilike('full_name', `%${searchName}%`)
        .limit(1)
        .maybeSingle();

      if (playerError) throw playerError;
      if (!playerData) {
        setError('Player not found');
        setLoading(false);
        return;
      }

      const enrichedPlayer: PlayerData = {
        ...playerData,
        fdp_value: getFDPValue(playerData)
      };

      setPlayer(enrichedPlayer);

      const metaTags = generatePlayerMetaTags(enrichedPlayer);
      document.title = metaTags.title;
      document.querySelector('meta[name="description"]')?.setAttribute('content', metaTags.description);

      const structuredData = generatePlayerStructuredData(enrichedPlayer, slug!);
      injectMultipleStructuredData([structuredData.sportsPerson, structuredData.faqPage]);

      loadSimilarPlayers(enrichedPlayer);
      loadValueHistory(enrichedPlayer.player_id);

    } catch (err) {
      console.error('Error loading player:', err);
      setError('Failed to load player data');
    } finally {
      setLoading(false);
    }
  }

  async function loadSimilarPlayers(currentPlayer: PlayerData) {
    try {
      const { data, error } = await supabase
        .rpc('get_latest_player_values', {})
        .eq('position', currentPlayer.position)
        .neq('player_id', currentPlayer.player_id)
        .gte('base_value', currentPlayer.base_value - 500)
        .lte('base_value', currentPlayer.base_value + 500)
        .order('base_value', { ascending: false })
        .limit(10);

      if (error) throw error;

      const enriched = data.map((p: any) => ({
        ...p,
        fdp_value: getFDPValue(p)
      }));

      setSimilarPlayers(enriched);
    } catch (err) {
      console.error('Error loading similar players:', err);
    }
  }

  async function loadValueHistory(playerId: string) {
    try {
      const { data, error } = await supabase
        .from('ktc_value_snapshots')
        .select('fdp_value, snapshot_date')
        .eq('player_id', playerId)
        .order('snapshot_date', { ascending: true })
        .limit(30);

      if (error) throw error;

      if (data && data.length > 0) {
        setValueHistory(data.map(d => ({
          value: d.fdp_value,
          date: d.snapshot_date,
          explanation: undefined
        })));
      }
    } catch (err) {
      console.error('Error loading value history:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-6xl mx-auto">
          <ListSkeleton count={5} />
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-fdp-text-1 mb-4">Player Not Found</h1>
          <p className="text-fdp-text-3 mb-8">{error}</p>
          <Link
            to="/dynasty-rankings"
            className="text-fdp-accent-1 hover:text-fdp-accent-2 font-semibold"
          >
            ← Back to Rankings
          </Link>
        </div>
      </div>
    );
  }

  const lastUpdated = new Date(player.value_epoch);
  const relativeTime = getRelativeTime(lastUpdated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <Link to="/dynasty-rankings" className="hover:text-fdp-accent-1">Dynasty Rankings</Link>
          {' / '}
          <span className="text-fdp-text-1">{player.full_name}</span>
        </nav>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-fdp-text-1 mb-2">
                {player.full_name} Dynasty Value & Trade Analysis (2026)
              </h1>
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-lg text-fdp-text-2">{player.position}</span>
                {player.team && (
                  <>
                    <span className="text-fdp-text-3">•</span>
                    <span className="text-lg text-fdp-text-2">{player.team}</span>
                  </>
                )}
                {player.age && (
                  <>
                    <span className="text-fdp-text-3">•</span>
                    <span className="text-lg text-fdp-text-2">Age {player.age}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-fdp-text-3 mb-6">
            <Calendar className="w-4 h-4" />
            <span>Values updated: {relativeTime}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-fdp-surface-2 rounded-lg p-6 border border-fdp-border-1">
              <div className="text-sm text-fdp-text-3 mb-2">Current Dynasty Value</div>
              <div className="text-4xl font-bold text-fdp-accent-1 mb-1">{player.fdp_value}</div>
              <div className="text-xs text-fdp-text-3">FDP Points</div>
            </div>

            <div className="bg-fdp-surface-2 rounded-lg p-6 border border-fdp-border-1">
              <div className="text-sm text-fdp-text-3 mb-2">Dynasty Rank</div>
              <div className="text-4xl font-bold text-fdp-text-1 mb-1">
                {player.dynasty_rank ? `#${player.dynasty_rank}` : 'Unranked'}
              </div>
              <div className="text-xs text-fdp-text-3">Overall</div>
            </div>

            <div className="bg-fdp-surface-2 rounded-lg p-6 border border-fdp-border-1">
              <div className="text-sm text-fdp-text-3 mb-2">Value Tier</div>
              <div className="text-2xl font-bold text-fdp-text-1 mb-1">
                {player.tier || 'Mid-Tier'}
              </div>
              <div className="text-xs text-fdp-text-3">Classification</div>
            </div>
          </div>
        </div>

        {valueHistory.length > 0 && (
          <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Value History</h2>
            <p className="text-fdp-text-3 mb-6">
              Track {player.full_name}'s dynasty value changes over time. Our algorithm updates values daily based on performance, injuries, and market trends.
            </p>
            <ValueChart
              data={valueHistory.map(h => ({
                date: h.date,
                value: h.value
              }))}
            />
          </div>
        )}

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Trade Value Analysis</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-fdp-text-2 mb-4">
              {player.full_name} currently ranks as the <strong>#{player.dynasty_rank || 'N/A'} player</strong> in dynasty fantasy football with a value of <strong>{player.fdp_value} points</strong>.
              {player.position === 'QB' && ' As a quarterback, their value is heavily influenced by scoring format, with superflex leagues typically valuing QBs significantly higher.'}
              {player.position === 'RB' && ' Running backs in dynasty require careful evaluation of age, workload, and team situation due to the position\'s shorter shelf life.'}
              {player.position === 'WR' && ' Wide receivers offer longer dynasty windows than running backs, making them valuable long-term assets.'}
              {player.position === 'TE' && ' Tight ends are scarce in fantasy, and top options command premium values in dynasty formats.'}
            </p>
            <p className="text-fdp-text-2">
              Use our trade calculator to evaluate deals involving {player.full_name}. Compare their value against other players or draft picks to ensure fair trades. Consider league settings, roster construction, and team strategy when making trade decisions.
            </p>
          </div>
        </div>

        {similarPlayers.length > 0 && (
          <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Similar Players & Trade Targets
            </h2>
            <p className="text-fdp-text-3 mb-6">
              Players with similar dynasty values to {player.full_name}. These players can serve as trade comparables or potential targets.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {similarPlayers.map(sim => (
                <Link
                  key={sim.player_id}
                  to={`/dynasty-value/${generatePlayerSlug(sim.full_name)}`}
                  className="bg-fdp-surface-2 rounded-lg p-4 border border-fdp-border-1 hover:border-fdp-accent-1 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-fdp-text-1 group-hover:text-fdp-accent-1 transition-colors">
                        {sim.full_name}
                      </div>
                      <div className="text-sm text-fdp-text-3">
                        {sim.position} • {sim.team || 'FA'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-fdp-accent-1">{sim.fdp_value}</div>
                      <div className="text-xs text-fdp-text-3">
                        {sim.dynasty_rank ? `#${sim.dynasty_rank}` : 'Unranked'}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-fdp-text-1 mb-2">
                What is {player.full_name}'s dynasty value?
              </h3>
              <p className="text-fdp-text-2">
                {player.full_name} currently has a dynasty value of {player.fdp_value} points and is ranked {player.dynasty_rank ? `#${player.dynasty_rank}` : 'unranked'} overall in dynasty fantasy football. This value is calculated using our proprietary FDP algorithm that factors in age, production, situation, and market consensus.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-fdp-text-1 mb-2">
                Is {player.full_name} a buy low or sell high?
              </h3>
              <p className="text-fdp-text-2">
                Based on {player.full_name}'s current value trends and market position, check the value history chart above for recent movement. Sudden drops may indicate buy-low opportunities, while rapid increases could signal sell-high windows.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-fdp-text-1 mb-2">
                Who is similar to {player.full_name} in dynasty rankings?
              </h3>
              <p className="text-fdp-text-2">
                Players with similar dynasty values to {player.full_name} are listed in the "Similar Players" section above. These players can serve as trade targets or comparables when evaluating {player.full_name}'s value in your league.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 text-center">
          <h2 className="text-xl font-bold text-fdp-text-1 mb-4">
            Use Our Trade Calculator
          </h2>
          <p className="text-fdp-text-3 mb-6">
            Evaluate trades involving {player.full_name} with our comprehensive trade analyzer. Compare values, get fairness ratings, and make informed decisions.
          </p>
          <Link
            to="/trade-calculator"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-3 px-8 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
          >
            Open Trade Calculator
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}
