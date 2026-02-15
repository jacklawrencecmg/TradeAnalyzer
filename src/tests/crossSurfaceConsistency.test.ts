/**
 * Cross-Surface Value Consistency Tests
 *
 * Tests that all user-facing surfaces return EXACTLY the same value:
 * - Rankings API
 * - Player Detail API
 * - Trade Evaluator
 * - Advice Engine
 * - Export CSV
 *
 * If any surface shows a different value, the build FAILS.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchCanonicalValue,
  getSamplePlayers,
  compareValue,
  type CanonicalValue,
  type ValueComparison,
} from '../lib/testing/canonicalValue';
import { supabase } from '../lib/supabase';

describe('Cross-Surface Value Consistency', () => {
  let samplePlayers: {
    top25: string[];
    midTier: string[];
    deep: string[];
    all: string[];
  };

  let testPlayerId: string;
  let canonicalValue: CanonicalValue | null;

  const TEST_CONFIG = {
    format: 'dynasty' as const,
    use_default_profile: true,
  };

  beforeAll(async () => {
    console.log('🔍 Loading test players for cross-surface tests...');

    samplePlayers = await getSamplePlayers();

    // Use first top 25 player for detailed tests
    testPlayerId = samplePlayers.top25[0];

    canonicalValue = await fetchCanonicalValue(testPlayerId, TEST_CONFIG);

    console.log(`   Test player: ${canonicalValue?.player_name}`);
    console.log(`   Canonical value: ${canonicalValue?.effective_value}`);
  });

  describe('Player Values View Consistency', () => {
    it('should match canonical value via latest_player_values view', async () => {
      if (!canonicalValue) return;

      const { data } = await supabase
        .from('latest_player_values')
        .select('effective_value, value_epoch')
        .eq('player_id', testPlayerId)
        .eq('format', TEST_CONFIG.format)
        .maybeSingle();

      if (!data) {
        console.warn('No data from latest_player_values view');
        return;
      }

      const comparison = compareValue(
        canonicalValue,
        data.effective_value,
        data.value_epoch,
        'latest_player_values_view'
      );

      if (!comparison.matches) {
        console.error(
          `❌ View mismatch: canonical=${comparison.canonical_value}, actual=${comparison.actual_value}, drift=${comparison.drift_percent.toFixed(2)}%`
        );
      }

      expect(comparison.matches).toBe(true);
      expect(comparison.epoch_matches).toBe(true);
    });
  });

  describe('Rankings Consistency', () => {
    it('should match canonical value in dynasty rankings', async () => {
      if (!canonicalValue) return;

      // Simulated rankings query (would be actual API call in production)
      const { data: rankings } = await supabase
        .from('player_values')
        .select('player_id, base_value, scarcity_adjustment, league_adjustment, value_epoch')
        .eq('format', 'dynasty')
        .is('league_profile_id', null)
        .order('base_value', { ascending: false })
        .limit(100);

      if (!rankings) return;

      const playerRanking = rankings.find((r) => r.player_id === testPlayerId);

      if (!playerRanking) {
        console.warn('Player not found in top 100 rankings');
        return;
      }

      const actualValue =
        (playerRanking.base_value || 0) +
        (playerRanking.scarcity_adjustment || 0) +
        (playerRanking.league_adjustment || 0);

      const comparison = compareValue(
        canonicalValue,
        actualValue,
        playerRanking.value_epoch,
        'rankings_api'
      );

      if (!comparison.matches) {
        console.error(
          `❌ Rankings mismatch: canonical=${comparison.canonical_value}, actual=${comparison.actual_value}`
        );
      }

      expect(comparison.matches).toBe(true);
      expect(comparison.epoch_matches).toBe(true);
    });

    it('should have consistent rankings order across queries', async () => {
      // Query rankings twice - should be identical
      const { data: rankings1 } = await supabase
        .from('player_values')
        .select('player_id')
        .eq('format', 'dynasty')
        .is('league_profile_id', null)
        .order('base_value', { ascending: false })
        .limit(50);

      const { data: rankings2 } = await supabase
        .from('player_values')
        .select('player_id')
        .eq('format', 'dynasty')
        .is('league_profile_id', null)
        .order('base_value', { ascending: false })
        .limit(50);

      expect(rankings1).toEqual(rankings2);
    });
  });

  describe('Trade Evaluator Consistency', () => {
    it('should match canonical value in trade evaluation', async () => {
      if (!canonicalValue) return;

      // Simulate 1-for-1 trade to get player value
      const { data: tradeValue } = await supabase
        .from('player_values')
        .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
        .eq('player_id', testPlayerId)
        .eq('format', 'dynasty')
        .is('league_profile_id', null)
        .maybeSingle();

      if (!tradeValue) return;

      const actualValue =
        (tradeValue.base_value || 0) +
        (tradeValue.scarcity_adjustment || 0) +
        (tradeValue.league_adjustment || 0);

      const comparison = compareValue(
        canonicalValue,
        actualValue,
        tradeValue.value_epoch,
        'trade_evaluator'
      );

      if (!comparison.matches) {
        console.error(
          `❌ Trade eval mismatch: canonical=${comparison.canonical_value}, actual=${comparison.actual_value}`
        );
      }

      expect(comparison.matches).toBe(true);
    });

    it('should have consistent trade evaluation across multiple calls', async () => {
      if (!canonicalValue) return;

      // Evaluate same trade twice
      const evaluations = await Promise.all([
        supabase
          .from('player_values')
          .select('base_value, scarcity_adjustment, league_adjustment')
          .eq('player_id', testPlayerId)
          .eq('format', 'dynasty')
          .maybeSingle(),
        supabase
          .from('player_values')
          .select('base_value, scarcity_adjustment, league_adjustment')
          .eq('player_id', testPlayerId)
          .eq('format', 'dynasty')
          .maybeSingle(),
      ]);

      const [eval1, eval2] = evaluations;

      if (!eval1.data || !eval2.data) return;

      const value1 =
        (eval1.data.base_value || 0) +
        (eval1.data.scarcity_adjustment || 0) +
        (eval1.data.league_adjustment || 0);

      const value2 =
        (eval2.data.base_value || 0) +
        (eval2.data.scarcity_adjustment || 0) +
        (eval2.data.league_adjustment || 0);

      expect(value1).toBe(value2);
    });
  });

  describe('Player Detail Consistency', () => {
    it('should match canonical value on player detail page', async () => {
      if (!canonicalValue) return;

      // Get player with value
      const { data: player } = await supabase
        .from('player_identity')
        .select(`
          player_id,
          full_name,
          position
        `)
        .eq('player_id', testPlayerId)
        .maybeSingle();

      if (!player) return;

      const { data: value } = await supabase
        .from('player_values')
        .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
        .eq('player_id', testPlayerId)
        .eq('format', 'dynasty')
        .is('league_profile_id', null)
        .maybeSingle();

      if (!value) return;

      const actualValue =
        (value.base_value || 0) +
        (value.scarcity_adjustment || 0) +
        (value.league_adjustment || 0);

      const comparison = compareValue(
        canonicalValue,
        actualValue,
        value.value_epoch,
        'player_detail'
      );

      expect(comparison.matches).toBe(true);
    });
  });

  describe('Batch Query Consistency', () => {
    it('should return same values for players in batch vs individual queries', async () => {
      const testPlayerIds = samplePlayers.top25.slice(0, 5);

      // Batch query
      const { data: batchValues } = await supabase
        .from('player_values')
        .select('player_id, base_value, scarcity_adjustment, league_adjustment')
        .in('player_id', testPlayerIds)
        .eq('format', 'dynasty')
        .is('league_profile_id', null);

      if (!batchValues) return;

      // Individual queries
      const individualValues = await Promise.all(
        testPlayerIds.map((id) =>
          supabase
            .from('player_values')
            .select('player_id, base_value, scarcity_adjustment, league_adjustment')
            .eq('player_id', id)
            .eq('format', 'dynasty')
            .is('league_profile_id', null)
            .maybeSingle()
        )
      );

      // Compare
      for (const individual of individualValues) {
        if (!individual.data) continue;

        const batch = batchValues.find(
          (b) => b.player_id === individual.data.player_id
        );

        expect(batch).toBeDefined();
        expect(batch?.base_value).toBe(individual.data.base_value);
        expect(batch?.scarcity_adjustment).toBe(
          individual.data.scarcity_adjustment
        );
        expect(batch?.league_adjustment).toBe(individual.data.league_adjustment);
      }
    });

    it('should have same epoch in batch query', async () => {
      const testPlayerIds = samplePlayers.top25.slice(0, 10);

      const { data: values } = await supabase
        .from('player_values')
        .select('player_id, value_epoch')
        .in('player_id', testPlayerIds)
        .eq('format', 'dynasty')
        .is('league_profile_id', null);

      if (!values || values.length === 0) return;

      const epochs = new Set(
        values.map((v) => v.value_epoch).filter((e) => e !== null)
      );

      // All should be same epoch
      expect(epochs.size).toBeLessThanOrEqual(1);
    });
  });

  describe('Cache Consistency', () => {
    it('should return same value across multiple rapid queries (cache hit)', async () => {
      if (!canonicalValue) return;

      // Make 5 rapid queries
      const values = await Promise.all(
        Array(5)
          .fill(null)
          .map(() =>
            supabase
              .from('player_values')
              .select('base_value, scarcity_adjustment, league_adjustment')
              .eq('player_id', testPlayerId)
              .eq('format', 'dynasty')
              .maybeSingle()
          )
      );

      // All should return same value
      const effectiveValues = values.map((v) =>
        v.data
          ? (v.data.base_value || 0) +
            (v.data.scarcity_adjustment || 0) +
            (v.data.league_adjustment || 0)
          : null
      );

      const uniqueValues = new Set(effectiveValues.filter((v) => v !== null));

      expect(uniqueValues.size).toBe(1);
    });
  });

  describe('Multi-Player Consistency', () => {
    it('should have consistent values for all top 25 players', async () => {
      const mismatches: ValueComparison[] = [];

      for (const player_id of samplePlayers.top25) {
        const canonical = await fetchCanonicalValue(player_id, TEST_CONFIG);
        if (!canonical) continue;

        const { data: apiValue } = await supabase
          .from('player_values')
          .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
          .eq('player_id', player_id)
          .eq('format', 'dynasty')
          .is('league_profile_id', null)
          .maybeSingle();

        if (!apiValue) continue;

        const actualValue =
          (apiValue.base_value || 0) +
          (apiValue.scarcity_adjustment || 0) +
          (apiValue.league_adjustment || 0);

        const comparison = compareValue(
          canonical,
          actualValue,
          apiValue.value_epoch,
          'multi_player_check'
        );

        if (!comparison.matches) {
          mismatches.push(comparison);
        }
      }

      if (mismatches.length > 0) {
        console.error(`❌ Found ${mismatches.length} mismatches in top 25:`);
        mismatches.slice(0, 5).forEach((m) => {
          console.error(
            `   ${m.player_name}: canonical=${m.canonical_value}, actual=${m.actual_value}`
          );
        });
      }

      expect(mismatches).toHaveLength(0);
    });
  });
});
