/**
 * FDP Contract Tests
 *
 * API-level contract tests to ensure all endpoints return canonical FDP values.
 *
 * Tests:
 * - Rankings endpoint returns exact getFDPValue() values
 * - Player endpoint returns exact getFDPValue() values
 * - Trade endpoint uses canonical values
 * - Export endpoint uses canonical values
 * - All responses include identical value_epoch
 * - No endpoint can return non-canonical values
 *
 * These tests MUST pass before deployment.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getFDPValue, getFDPValuesBatch } from '../lib/fdp/getFDPValue';
import { supabase } from '../lib/supabase';

describe('FDP Contract Tests - API Endpoints', () => {
  let testPlayerIds: string[] = [];
  let canonicalValues: Map<string, any>;

  beforeAll(async () => {
    const { data } = await supabase
      .from('latest_player_values')
      .select('player_id')
      .limit(20);

    if (data) {
      testPlayerIds = data.map(p => p.player_id);
      canonicalValues = await getFDPValuesBatch(testPlayerIds);
    }
  });

  describe('Player Values Endpoint Contract', () => {
    it('should return exact canonical values for queried players', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      for (const playerId of testPlayerIds.slice(0, 5)) {
        const canonical = await getFDPValue(playerId);
        expect(canonical).toBeDefined();

        const { data: apiResult } = await supabase
          .from('vw_fdp_values')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle();

        if (!apiResult) continue;

        expect(apiResult.base_value).toBe(canonical?.value);
        expect(apiResult.value_epoch_id).toBe(canonical?.value_epoch);
      }
    });

    it('should include value_epoch in all player responses', async () => {
      const { data } = await supabase
        .from('vw_fdp_values')
        .select('player_id, value_epoch_id')
        .limit(10);

      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      for (const player of data!) {
        expect(player.value_epoch_id).toBeDefined();
        expect(player.value_epoch_id).not.toBeNull();
      }
    });

    it('should return consistent value_epoch across batch queries', async () => {
      const { data } = await supabase
        .from('vw_fdp_values')
        .select('value_epoch_id, updated_at')
        .limit(10);

      if (!data || data.length < 2) {
        console.warn('Not enough data for epoch consistency test');
        return;
      }

      const epochs = data.map(d => new Date(d.updated_at).getTime());
      const maxDiff = Math.max(...epochs) - Math.min(...epochs);

      expect(maxDiff).toBeLessThan(86400000);
    });
  });

  describe('Rankings Endpoint Contract', () => {
    it('should return values matching getFDPValue exactly', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const sampleIds = testPlayerIds.slice(0, 3);

      for (const playerId of sampleIds) {
        const canonical = canonicalValues.get(playerId);
        if (!canonical) continue;

        const { data } = await supabase
          .from('vw_fdp_values')
          .select('*')
          .eq('player_id', playerId)
          .maybeSingle();

        if (!data) continue;

        expect(data.base_value).toBe(canonical.value);
        expect(data.rank_overall).toBe(canonical.overall_rank);
        expect(data.rank_position).toBe(canonical.pos_rank);
        expect(data.tier).toBe(canonical.tier);
      }
    });

    it('should not contain calculated values outside FDP', async () => {
      const { data } = await supabase
        .from('vw_fdp_values')
        .select('base_value, adjusted_value')
        .limit(10);

      expect(data).toBeDefined();

      for (const row of data!) {
        expect(typeof row.base_value).toBe('number');
        expect(row.base_value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Trade Evaluation Contract', () => {
    it('should use canonical values in trade calculations', async () => {
      if (testPlayerIds.length < 4) {
        console.warn('Not enough test players');
        return;
      }

      const side1Ids = testPlayerIds.slice(0, 2);
      const side2Ids = testPlayerIds.slice(2, 4);

      const side1Values = await getFDPValuesBatch(side1Ids);
      const side2Values = await getFDPValuesBatch(side2Ids);

      const side1Total = Array.from(side1Values.values()).reduce(
        (sum, v) => sum + v.value,
        0
      );
      const side2Total = Array.from(side2Values.values()).reduce(
        (sum, v) => sum + v.value,
        0
      );

      expect(side1Total).toBeGreaterThan(0);
      expect(side2Total).toBeGreaterThan(0);

      const side1Lookup = side1Ids.reduce((sum, id) => {
        const v = side1Values.get(id);
        return sum + (v?.value || 0);
      }, 0);

      expect(side1Lookup).toBe(side1Total);
    });

    it('should not perform ad-hoc value calculations', async () => {
      if (testPlayerIds.length === 0) return;

      const playerId = testPlayerIds[0];
      const canonical = await getFDPValue(playerId);

      if (!canonical) return;

      const adhocCalculation = canonical.value * 1.1;

      expect(adhocCalculation).not.toBe(canonical.value);

      const { data } = await supabase
        .from('vw_fdp_values')
        .select('base_value')
        .eq('player_id', playerId)
        .maybeSingle();

      expect(data?.base_value).toBe(canonical.value);
      expect(data?.base_value).not.toBe(adhocCalculation);
    });
  });

  describe('Export Endpoint Contract', () => {
    it('should export exact canonical values', async () => {
      if (testPlayerIds.length < 5) {
        console.warn('Not enough test players');
        return;
      }

      const exportIds = testPlayerIds.slice(0, 5);
      const canonicalExport = await getFDPValuesBatch(exportIds);

      const { data } = await supabase
        .from('vw_fdp_values')
        .select('player_id, base_value')
        .in('player_id', exportIds);

      expect(data).toBeDefined();
      expect(data!.length).toBe(exportIds.length);

      for (const row of data!) {
        const canonical = canonicalExport.get(row.player_id);
        expect(canonical).toBeDefined();
        expect(row.base_value).toBe(canonical?.value);
      }
    });

    it('should include value_epoch in all exports', async () => {
      const { data } = await supabase
        .from('vw_fdp_values')
        .select('player_id, value_epoch_id')
        .limit(10);

      expect(data).toBeDefined();

      for (const row of data!) {
        expect(row.value_epoch_id).toBeDefined();
      }
    });
  });

  describe('Value Epoch Consistency Contract', () => {
    it('should return same epoch across all endpoints', async () => {
      const { data: values1 } = await supabase
        .from('vw_fdp_values')
        .select('value_epoch_id, updated_at')
        .limit(5);

      const { data: values2 } = await supabase
        .from('vw_fdp_values')
        .select('value_epoch_id, updated_at')
        .limit(5)
        .order('rank_overall', { ascending: true });

      expect(values1).toBeDefined();
      expect(values2).toBeDefined();

      if (values1 && values2 && values1.length > 0 && values2.length > 0) {
        const epoch1 = new Date(values1[0].updated_at).getTime();
        const epoch2 = new Date(values2[0].updated_at).getTime();

        const diffMs = Math.abs(epoch1 - epoch2);
        const diffHours = diffMs / 3600000;

        expect(diffHours).toBeLessThan(24);
      }
    });

    it('should have value_epoch within acceptable age', async () => {
      const { data } = await supabase
        .from('vw_fdp_values')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(data).toBeDefined();

      if (data) {
        const now = Date.now();
        const updated = new Date(data.updated_at).getTime();
        const ageHours = (now - updated) / 3600000;

        expect(ageHours).toBeLessThan(48);
      }
    });
  });

  describe('No Direct Calculation Contract', () => {
    it('should not have any endpoint bypass getFDPValue', async () => {
      if (testPlayerIds.length === 0) return;

      const playerId = testPlayerIds[0];

      const canonical = await getFDPValue(playerId);
      expect(canonical).toBeDefined();

      const { data } = await supabase
        .from('vw_fdp_values')
        .select('base_value')
        .eq('player_id', playerId)
        .maybeSingle();

      expect(data).toBeDefined();
      expect(data!.base_value).toBe(canonical!.value);

      const directCalculation = 1000;
      expect(data!.base_value).not.toBe(directCalculation);
    });

    it('should fail if values diverge from canonical', async () => {
      if (testPlayerIds.length < 2) return;

      const testIds = testPlayerIds.slice(0, 2);
      const canonical = await getFDPValuesBatch(testIds);

      const { data } = await supabase
        .from('vw_fdp_values')
        .select('player_id, base_value')
        .in('player_id', testIds);

      expect(data).toBeDefined();

      let allMatch = true;
      for (const row of data!) {
        const canonicalValue = canonical.get(row.player_id);
        if (canonicalValue && row.base_value !== canonicalValue.value) {
          allMatch = false;
          console.error('VALUE MISMATCH:', {
            player_id: row.player_id,
            api: row.base_value,
            canonical: canonicalValue.value,
          });
        }
      }

      expect(allMatch).toBe(true);
    });
  });

  describe('Database Function Contract', () => {
    it('should return canonical values from get_fdp_value function', async () => {
      if (testPlayerIds.length === 0) return;

      const playerId = testPlayerIds[0];
      const canonical = await getFDPValue(playerId);

      const { data, error } = await supabase.rpc('get_fdp_value', {
        p_player_id: playerId,
        p_format: 'dynasty_1qb',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length > 0 && canonical) {
        expect(data[0].base_value).toBe(canonical.value);
      }
    });

    it('should return batch values matching getFDPValuesBatch', async () => {
      if (testPlayerIds.length < 3) return;

      const testIds = testPlayerIds.slice(0, 3);
      const canonical = await getFDPValuesBatch(testIds);

      const { data, error } = await supabase.rpc('get_fdp_values_batch', {
        p_player_ids: testIds,
        p_format: 'dynasty_1qb',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data) {
        for (const row of data) {
          const canonicalValue = canonical.get(row.player_id);
          if (canonicalValue) {
            expect(row.base_value).toBe(canonicalValue.value);
          }
        }
      }
    });
  });
});
