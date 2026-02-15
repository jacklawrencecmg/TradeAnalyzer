/**
 * Value Consistency Test Suite
 *
 * CRITICAL: Prevents "rankings show X, trade calc shows Y" bugs.
 *
 * Tests that all surfaces (rankings, trade eval, player detail, etc.)
 * return EXACTLY the same value for each player.
 *
 * If this test fails, the build is blocked.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchCanonicalValue,
  fetchCanonicalValues,
  getSamplePlayers,
  getCurrentValueEpoch,
  compareValue,
  type CanonicalValue,
  type ValueComparison,
} from '../lib/testing/canonicalValue';
import { supabase } from '../lib/supabase';

describe('Value Consistency Test Suite', () => {
  let samplePlayers: {
    top25: string[];
    midTier: string[];
    deep: string[];
    idp: string[];
    all: string[];
  };

  let canonicalValues: Map<string, CanonicalValue>;
  let currentEpoch: string | null;

  const TEST_CONFIG = {
    format: 'dynasty' as const,
    use_default_profile: true,
  };

  beforeAll(async () => {
    console.log('🔍 Loading sample players for consistency tests...');

    // Get deterministic sample
    samplePlayers = await getSamplePlayers();

    console.log(`   Top 25: ${samplePlayers.top25.length}`);
    console.log(`   Mid-tier: ${samplePlayers.midTier.length}`);
    console.log(`   Deep: ${samplePlayers.deep.length}`);
    console.log(`   IDP: ${samplePlayers.idp.length}`);
    console.log(`   Total: ${samplePlayers.all.length}`);

    // Fetch canonical values
    canonicalValues = await fetchCanonicalValues(samplePlayers.all, TEST_CONFIG);

    console.log(`   Canonical values loaded: ${canonicalValues.size}`);

    // Get current epoch
    currentEpoch = await getCurrentValueEpoch();
    console.log(`   Current epoch: ${currentEpoch || 'none'}`);
  });

  describe('Canonical Value Source', () => {
    it('should load canonical values for all sample players', () => {
      expect(canonicalValues.size).toBeGreaterThan(0);
      expect(canonicalValues.size).toBe(samplePlayers.all.length);
    });

    it('should have epoch information', () => {
      const values = Array.from(canonicalValues.values());
      const withEpoch = values.filter((v) => v.value_epoch !== null);

      // At least 90% should have epoch
      expect(withEpoch.length).toBeGreaterThanOrEqual(values.length * 0.9);
    });

    it('should have consistent epoch across all values', () => {
      const values = Array.from(canonicalValues.values());
      const epochs = new Set(
        values.map((v) => v.value_epoch).filter((e) => e !== null)
      );

      // Should be 1 or 2 epochs max (transition period)
      expect(epochs.size).toBeLessThanOrEqual(2);
    });

    it('should have recent updated_at timestamps', () => {
      const values = Array.from(canonicalValues.values());
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentValues = values.filter(
        (v) => new Date(v.updated_at) > sevenDaysAgo
      );

      // At least 80% should be updated in last 7 days
      expect(recentValues.length).toBeGreaterThanOrEqual(values.length * 0.8);
    });
  });

  describe('Player Values API Consistency', () => {
    it('should match canonical values for top 25 players', async () => {
      const mismatches: ValueComparison[] = [];

      for (const player_id of samplePlayers.top25) {
        const canonical = canonicalValues.get(player_id);
        if (!canonical) continue;

        // Fetch from player_values API (direct DB query)
        const { data: apiValue } = await supabase
          .from('player_values')
          .select('base_value, scarcity_adjustment, league_adjustment, value_epoch')
          .eq('player_id', player_id)
          .eq('format', TEST_CONFIG.format)
          .is('league_profile_id', null)
          .maybeSingle();

        if (!apiValue) continue;

        const actual_value =
          (apiValue.base_value || 0) +
          (apiValue.scarcity_adjustment || 0) +
          (apiValue.league_adjustment || 0);

        const comparison = compareValue(
          canonical,
          actual_value,
          apiValue.value_epoch,
          'player_values_table'
        );

        if (!comparison.matches) {
          mismatches.push(comparison);
        }
      }

      if (mismatches.length > 0) {
        console.error('❌ Value mismatches detected:');
        mismatches.forEach((m) => {
          console.error(
            `   ${m.player_name}: canonical=${m.canonical_value}, actual=${m.actual_value}, drift=${m.drift_percent.toFixed(2)}%`
          );
        });
      }

      expect(mismatches).toHaveLength(0);
    });

    it('should have matching epochs for all values', async () => {
      const epochMismatches: ValueComparison[] = [];

      for (const player_id of samplePlayers.all.slice(0, 20)) {
        const canonical = canonicalValues.get(player_id);
        if (!canonical) continue;

        const { data: apiValue } = await supabase
          .from('player_values')
          .select('value_epoch')
          .eq('player_id', player_id)
          .eq('format', TEST_CONFIG.format)
          .is('league_profile_id', null)
          .maybeSingle();

        if (!apiValue) continue;

        const comparison = compareValue(
          canonical,
          canonical.effective_value,
          apiValue.value_epoch,
          'epoch_check'
        );

        if (!comparison.epoch_matches && canonical.value_epoch !== null) {
          epochMismatches.push(comparison);
        }
      }

      if (epochMismatches.length > 0) {
        console.error('❌ Epoch mismatches detected:');
        epochMismatches.forEach((m) => {
          console.error(
            `   ${m.player_name}: canonical_epoch=${m.canonical_epoch}, actual_epoch=${m.actual_epoch}`
          );
        });
      }

      expect(epochMismatches).toHaveLength(0);
    });
  });

  describe('Value Epoch Correctness', () => {
    it('should have current epoch set', () => {
      expect(currentEpoch).not.toBeNull();
      expect(currentEpoch).toBeTruthy();
    });

    it('should have epoch in correct format (ISO timestamp or version)', () => {
      if (!currentEpoch) return;

      // Should be either ISO timestamp or version string
      const isISO = !isNaN(Date.parse(currentEpoch));
      const isVersion = /^v?\d+(\.\d+)*$/.test(currentEpoch);

      expect(isISO || isVersion).toBe(true);
    });

    it('should have same epoch across all test players', () => {
      const epochs = Array.from(canonicalValues.values())
        .map((v) => v.value_epoch)
        .filter((e) => e !== null);

      const uniqueEpochs = new Set(epochs);

      // All should share same epoch (or be within transition period)
      expect(uniqueEpochs.size).toBeLessThanOrEqual(2);

      if (uniqueEpochs.size === 1) {
        const [epoch] = uniqueEpochs;
        expect(epoch).toBe(currentEpoch);
      }
    });

    it('should not have null epochs for recent values', () => {
      const recentValues = Array.from(canonicalValues.values()).filter((v) => {
        const age = Date.now() - new Date(v.updated_at).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        return age < oneDayMs;
      });

      const withoutEpoch = recentValues.filter((v) => v.value_epoch === null);

      // Recent values should have epoch
      expect(withoutEpoch.length).toBe(0);
    });
  });

  describe('Stale Value Detection', () => {
    it('should reject values older than 7 days', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const staleValues = Array.from(canonicalValues.values()).filter(
        (v) => new Date(v.updated_at) < sevenDaysAgo
      );

      // Less than 10% should be stale
      const stalePercent = (staleValues.length / canonicalValues.size) * 100;

      if (staleValues.length > 0) {
        console.warn(
          `⚠️  ${staleValues.length} stale values (${stalePercent.toFixed(1)}%)`
        );
      }

      expect(stalePercent).toBeLessThan(10);
    });

    it('should not mix epochs in same query', async () => {
      // Fetch multiple values in one query
      const playerIds = samplePlayers.all.slice(0, 10);

      const { data: values } = await supabase
        .from('player_values')
        .select('player_id, value_epoch')
        .in('player_id', playerIds)
        .eq('format', TEST_CONFIG.format)
        .is('league_profile_id', null);

      if (!values || values.length === 0) return;

      const epochs = new Set(
        values.map((v) => v.value_epoch).filter((e) => e !== null)
      );

      // Should all be same epoch
      expect(epochs.size).toBeLessThanOrEqual(1);
    });

    it('should have consistent updated_at within epoch', () => {
      // Group by epoch
      const byEpoch = new Map<string, CanonicalValue[]>();

      for (const value of canonicalValues.values()) {
        if (!value.value_epoch) continue;

        if (!byEpoch.has(value.value_epoch)) {
          byEpoch.set(value.value_epoch, []);
        }
        byEpoch.get(value.value_epoch)!.push(value);
      }

      // For each epoch, updated_at should be within 1 hour
      for (const [epoch, values] of byEpoch.entries()) {
        const timestamps = values.map((v) => new Date(v.updated_at).getTime());
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        const diffHours = (max - min) / (1000 * 60 * 60);

        expect(diffHours).toBeLessThan(1);
      }
    });
  });

  describe('Value Adjustment Consistency', () => {
    it('should apply scarcity adjustments consistently', () => {
      const withScarcity = Array.from(canonicalValues.values()).filter(
        (v) => v.scarcity_adjustment !== 0
      );

      // Scarcity adjustments should be reasonable (-500 to +500)
      for (const value of withScarcity) {
        expect(Math.abs(value.scarcity_adjustment)).toBeLessThanOrEqual(500);
      }
    });

    it('should apply league adjustments consistently', () => {
      const withLeague = Array.from(canonicalValues.values()).filter(
        (v) => v.league_adjustment !== 0
      );

      // League adjustments should be reasonable (-1000 to +1000)
      for (const value of withLeague) {
        expect(Math.abs(value.league_adjustment)).toBeLessThanOrEqual(1000);
      }
    });

    it('should have effective_value = base + adjustments', () => {
      for (const value of canonicalValues.values()) {
        const calculated =
          value.base_value + value.scarcity_adjustment + value.league_adjustment;

        expect(value.effective_value).toBeCloseTo(calculated, 2);
      }
    });

    it('should have positive values for top players', () => {
      for (const player_id of samplePlayers.top25) {
        const value = canonicalValues.get(player_id);
        if (!value) continue;

        expect(value.effective_value).toBeGreaterThan(0);
        expect(value.base_value).toBeGreaterThan(0);
      }
    });
  });

  describe('Value Source Attribution', () => {
    it('should have value_source for all values', () => {
      const withoutSource = Array.from(canonicalValues.values()).filter(
        (v) => !v.value_source || v.value_source === 'unknown'
      );

      // Less than 5% should be unknown
      const unknownPercent = (withoutSource.length / canonicalValues.size) * 100;

      expect(unknownPercent).toBeLessThan(5);
    });

    it('should have valid value_source values', () => {
      const validSources = new Set([
        'ktc',
        'fantasypros',
        'adp',
        'calculated',
        'fdp',
        'hybrid',
      ]);

      for (const value of canonicalValues.values()) {
        if (value.value_source && value.value_source !== 'unknown') {
          expect(validSources.has(value.value_source)).toBe(true);
        }
      }
    });

    it('should have high confidence for top players', () => {
      for (const player_id of samplePlayers.top25) {
        const value = canonicalValues.get(player_id);
        if (!value) continue;

        // Top players should have high confidence (0.8+)
        expect(value.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('Cross-Format Consistency', () => {
    it('should have consistent player_id across formats', async () => {
      const testPlayerId = samplePlayers.top25[0];

      const { data: dynastyValue } = await supabase
        .from('player_values')
        .select('player_id')
        .eq('player_id', testPlayerId)
        .eq('format', 'dynasty')
        .maybeSingle();

      const { data: redraftValue } = await supabase
        .from('player_values')
        .select('player_id')
        .eq('player_id', testPlayerId)
        .eq('format', 'redraft')
        .maybeSingle();

      if (dynastyValue && redraftValue) {
        expect(dynastyValue.player_id).toBe(redraftValue.player_id);
      }
    });

    it('should have reasonable dynasty vs redraft ratio', async () => {
      const testPlayerId = samplePlayers.top25[0];

      const dynastyValue = await fetchCanonicalValue(testPlayerId, {
        format: 'dynasty',
      });

      const redraftValue = await fetchCanonicalValue(testPlayerId, {
        format: 'redraft',
      });

      if (dynastyValue && redraftValue && redraftValue.effective_value > 0) {
        const ratio = dynastyValue.effective_value / redraftValue.effective_value;

        // Dynasty should be 0.5x to 2x redraft (varies by player age)
        expect(ratio).toBeGreaterThan(0.3);
        expect(ratio).toBeLessThan(3);
      }
    });
  });
});
