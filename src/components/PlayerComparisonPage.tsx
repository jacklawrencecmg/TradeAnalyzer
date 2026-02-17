import { useEffect, useState } from 'react';
import { ArrowRight, TrendingUp, Users, Award } from 'lucide-react';
import { useParams, Link } from '../lib/seo/router';
import { supabase } from '../lib/supabase';
import { generateComparisonMetaTags, parsePlayerSlug, generatePlayerSlug } from '../lib/seo/meta';
import { getFDPValue } from '../lib/fdp/getFDPValue';
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
}

export function PlayerComparisonPage() {
  const { slug } = useParams<{ slug: string }>();
  const [player1, setPlayer1] = useState<PlayerData | null>(null);
  const [player2, setPlayer2] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;

    const parts = slug.split('-vs-');
    if (parts.length !== 2) {
      setError('Invalid comparison URL');
      setLoading(false);
      return;
    }

    const player1Slug = parts[0];
    const player2Slug = parts[1].replace('-dynasty', '');

    loadPlayers(player1Slug, player2Slug);
  }, [slug]);

  async function loadPlayers(slug1: string, slug2: string) {
    try {
      setLoading(true);
      setError('');

      const name1 = parsePlayerSlug(slug1);
      const name2 = parsePlayerSlug(slug2);

      const { data: allPlayers, error: playersError } = await supabase
        .rpc('get_latest_player_values', {});

      if (playersError) throw playersError;

      const p1 = allPlayers.find((p: any) =>
        p.full_name.toLowerCase().includes(name1.toLowerCase())
      );
      const p2 = allPlayers.find((p: any) =>
        p.full_name.toLowerCase().includes(name2.toLowerCase())
      );

      if (!p1 || !p2) {
        setError('One or both players not found');
        setLoading(false);
        return;
      }

      const enriched1: PlayerData = {
        ...p1,
        fdp_value: getFDPValue(p1)
      };

      const enriched2: PlayerData = {
        ...p2,
        fdp_value: getFDPValue(p2)
      };

      setPlayer1(enriched1);
      setPlayer2(enriched2);

      const metaTags = generateComparisonMetaTags(enriched1.full_name, enriched2.full_name);
      document.title = metaTags.title;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', metaTags.description);
      }

    } catch (err) {
      console.error('Error loading players:', err);
      setError('Failed to load player data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-6xl mx-auto">
          <ListSkeleton count={3} />
        </div>
      </div>
    );
  }

  if (error || !player1 || !player2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-fdp-text-1 mb-4">Comparison Not Available</h1>
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

  const valueDiff = player1.fdp_value - player2.fdp_value;
  const winner = valueDiff > 0 ? player1 : player2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <nav className="mb-6 text-sm text-fdp-text-3">
          <Link to="/" className="hover:text-fdp-accent-1">Home</Link>
          {' / '}
          <Link to="/dynasty-rankings" className="hover:text-fdp-accent-1">Dynasty Rankings</Link>
          {' / '}
          <span className="text-fdp-text-1">Comparison</span>
        </nav>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-fdp-text-1 mb-4">
            {player1.full_name} vs {player2.full_name} Dynasty Comparison (2026)
          </h1>
          <p className="text-lg text-fdp-text-2">
            Compare dynasty values, rankings, and trade analysis between {player1.full_name} and {player2.full_name}. See which player offers more value for your dynasty roster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-fdp-surface-1 rounded-xl p-6 border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all">
            <div className="flex items-center justify-between mb-4">
              <Link
                to={`/dynasty-value/${generatePlayerSlug(player1.full_name)}`}
                className="text-2xl font-bold text-fdp-text-1 hover:text-fdp-accent-1 transition-colors"
              >
                {player1.full_name}
              </Link>
              {winner.player_id === player1.player_id && (
                <Award className="w-6 h-6 text-fdp-accent-1" />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Position</span>
                <span className="text-fdp-text-1 font-semibold">{player1.position}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Team</span>
                <span className="text-fdp-text-1 font-semibold">{player1.team || 'FA'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Age</span>
                <span className="text-fdp-text-1 font-semibold">{player1.age || '-'}</span>
              </div>
              <div className="border-t border-fdp-border-1 pt-3 mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-fdp-text-3">Dynasty Value</span>
                  <span className="text-3xl font-bold text-fdp-accent-1">{player1.fdp_value}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fdp-text-3">Dynasty Rank</span>
                  <span className="text-xl font-bold text-fdp-text-1">
                    {player1.dynasty_rank ? `#${player1.dynasty_rank}` : 'Unranked'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-fdp-surface-1 rounded-xl p-6 border-2 border-fdp-border-1 hover:border-fdp-accent-1 transition-all">
            <div className="flex items-center justify-between mb-4">
              <Link
                to={`/dynasty-value/${generatePlayerSlug(player2.full_name)}`}
                className="text-2xl font-bold text-fdp-text-1 hover:text-fdp-accent-1 transition-colors"
              >
                {player2.full_name}
              </Link>
              {winner.player_id === player2.player_id && (
                <Award className="w-6 h-6 text-fdp-accent-1" />
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Position</span>
                <span className="text-fdp-text-1 font-semibold">{player2.position}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Team</span>
                <span className="text-fdp-text-1 font-semibold">{player2.team || 'FA'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-fdp-text-3">Age</span>
                <span className="text-fdp-text-1 font-semibold">{player2.age || '-'}</span>
              </div>
              <div className="border-t border-fdp-border-1 pt-3 mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-fdp-text-3">Dynasty Value</span>
                  <span className="text-3xl font-bold text-fdp-accent-1">{player2.fdp_value}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fdp-text-3">Dynasty Rank</span>
                  <span className="text-xl font-bold text-fdp-text-1">
                    {player2.dynasty_rank ? `#${player2.dynasty_rank}` : 'Unranked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Value Analysis
          </h2>

          <div className="bg-fdp-surface-2 rounded-lg p-6 border border-fdp-border-1 mb-6">
            <div className="text-center">
              <div className="text-sm text-fdp-text-3 mb-2">Value Difference</div>
              <div className={`text-4xl font-bold mb-2 ${
                valueDiff > 0 ? 'text-fdp-pos' : valueDiff < 0 ? 'text-fdp-neg' : 'text-fdp-text-1'
              }`}>
                {Math.abs(valueDiff)} points
              </div>
              <div className="text-fdp-text-2">
                {winner.full_name} has {Math.abs(valueDiff)} more dynasty value
              </div>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <p className="text-fdp-text-2 mb-4">
              In a dynasty trade, <strong>{winner.full_name}</strong> is currently the more valuable asset with a dynasty value of <strong>{winner.fdp_value}</strong> compared to {winner.player_id === player1.player_id ? player2.full_name : player1.full_name}'s value of <strong>{winner.player_id === player1.player_id ? player2.fdp_value : player1.fdp_value}</strong>.
            </p>

            {player1.position !== player2.position && (
              <p className="text-fdp-text-2 mb-4">
                Note that these players play different positions ({player1.position} vs {player2.position}), which affects positional scarcity and league-specific value. Consider your roster needs and league settings when evaluating this comparison.
              </p>
            )}

            <p className="text-fdp-text-2 mb-4">
              {player1.age && player2.age && (
                <>
                  Age is a critical factor in dynasty: {player1.full_name} is {player1.age} years old while {player2.full_name} is {player2.age} years old.
                  {Math.abs(player1.age - player2.age) >= 3 && (
                    <> The younger player typically offers a longer dynasty window, though peak production should also be considered.</>
                  )}
                </>
              )}
            </p>

            <p className="text-fdp-text-2">
              Use our trade calculator to evaluate specific trade scenarios involving these players. Add additional assets or picks to balance values and ensure fair trades.
            </p>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Trade Recommendation</h2>

          <div className="bg-fdp-surface-2 rounded-lg p-6 border border-fdp-border-1">
            {Math.abs(valueDiff) < 200 ? (
              <div>
                <div className="text-lg font-semibold text-fdp-text-1 mb-2">
                  Fair 1-for-1 Trade
                </div>
                <p className="text-fdp-text-2">
                  These players have similar dynasty values (within 200 points), making them suitable for a straight 1-for-1 trade. Consider roster needs, positional scarcity, and team strategy when deciding which player fits your dynasty better.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-semibold text-fdp-text-1 mb-2">
                  Additional Assets Required
                </div>
                <p className="text-fdp-text-2">
                  To balance this trade, the team receiving {winner.full_name} should add approximately {Math.abs(valueDiff)} points of value through additional players or draft picks. Use our trade calculator to build a fair multi-asset deal.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 md:p-8 border border-fdp-border-1 text-center">
          <h2 className="text-xl font-bold text-fdp-text-1 mb-4">
            Evaluate This Trade
          </h2>
          <p className="text-fdp-text-3 mb-6">
            Use our comprehensive trade calculator to evaluate multi-player deals, add draft picks, and get detailed fairness analysis.
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
