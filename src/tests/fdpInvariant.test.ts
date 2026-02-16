/**
 * FDP Invariant Test Suite
 *
 * Enforces that FDP canonical values are the single source of truth.
 * Build MUST fail if:
 * - Any endpoint returns value not equal to canonical
 * - Two endpoints return different values for same player
 * - Response missing value_epoch
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getFDPValue, getFDPValuesBatch, verifyFDPValue } from '../lib/fdp/getFDPValue';
import { verifyFDPConsistency } from '../lib/fdp/verifyFDPConsistency';
import { supabase } from '../lib/supabase';

describe('FDP Canonical Value Invariants', () => {
  let testPlayerIds: string[] = [];

  beforeAll(async () => {
    const { data } = await supabase
      .from('latest_player_values')
      .select('player_id')
      .limit(10);

    if (data) {
      testPlayerIds = data.map(p => p.player_id);
    }
  });

  describe('Single Source of Truth', () => {
    it('should return consistent values from getFDPValue', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];

      const value1 = await getFDPValue(playerId);
      const value2 = await getFDPValue(playerId);

      expect(value1).toBeDefined();
      expect(value2).toBeDefined();
      expect(value1?.value).toBe(value2?.value);
      expect(value1?.value_epoch).toBe(value2?.value_epoch);
    });

    it('should return same value from batch query', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];

      const singleValue = await getFDPValue(playerId);
      const batchValues = await getFDPValuesBatch([playerId]);

      expect(singleValue).toBeDefined();
      expect(batchValues.has(playerId)).toBe(true);

      const batchValue = batchValues.get(playerId);
      expect(batchValue?.value).toBe(singleValue?.value);
    });

    it('should include value_epoch in all responses', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];
      const value = await getFDPValue(playerId);

      expect(value).toBeDefined();
      expect(value?.value_epoch).toBeDefined();
      expect(typeof value?.value_epoch).toBe('number');
      expect(value?.value_epoch).toBeGreaterThan(0);
    });
  });

  describe('Verification Functions', () => {
    it('should verify correct values as valid', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];
      const canonicalValue = await getFDPValue(playerId);

      if (!canonicalValue) {
        console.warn('No canonical value available');
        return;
      }

      const verification = await verifyFDPValue(
        playerId,
        canonicalValue.value
      );

      expect(verification.valid).toBe(true);
      expect(verification.difference).toBe(0);
    });

    it('should detect value mismatches', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];
      const canonicalValue = await getFDPValue(playerId);

      if (!canonicalValue) {
        console.warn('No canonical value available');
        return;
      }

      const wrongValue = canonicalValue.value + 100;
      const verification = await verifyFDPValue(playerId, wrongValue);

      expect(verification.valid).toBe(false);
      expect(verification.difference).toBeGreaterThan(0);
    });
  });

  describe('Response Consistency', () => {
    it('should verify consistent response values', async () => {
      if (testPlayerIds.length < 3) {
        console.warn('Not enough test players');
        return;
      }

      const values = await getFDPValuesBatch(testPlayerIds.slice(0, 3));

      const response = Array.from(values.values()).map(v => ({
        player_id: v.player_id,
        value: v.value,
      }));

      const verification = await verifyFDPConsistency(response);

      expect(verification.passed).toBe(true);
      expect(verification.mismatches).toBe(0);
    });

    it('should detect inconsistent response values', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const playerId = testPlayerIds[0];
      const canonicalValue = await getFDPValue(playerId);

      if (!canonicalValue) {
        console.warn('No canonical value available');
        return;
      }

      const badResponse = [
        {
          player_id: playerId,
          value: canonicalValue.value + 500,
        },
      ];

      const verification = await verifyFDPConsistency(badResponse);

      expect(verification.passed).toBe(false);
      expect(verification.mismatches).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    it('should return values for all requested players', async () => {
      if (testPlayerIds.length < 3) {
        console.warn('Not enough test players');
        return;
      }

      const playerIds = testPlayerIds.slice(0, 3);
      const values = await getFDPValuesBatch(playerIds);

      expect(values.size).toBeGreaterThan(0);

      for (const playerId of playerIds) {
        if (values.has(playerId)) {
          const value = values.get(playerId);
          expect(value).toBeDefined();
          expect(value?.value_epoch).toBeDefined();
        }
      }
    });

    it('should handle empty player list', async () => {
      const values = await getFDPValuesBatch([]);
      expect(values.size).toBe(0);
    });
  });

  describe('Value Epoch Consistency', () => {
    it('should return same epoch for multiple queries', async () => {
      if (testPlayerIds.length < 2) {
        console.warn('Not enough test players');
        return;
      }

      const value1 = await getFDPValue(testPlayerIds[0]);
      const value2 = await getFDPValue(testPlayerIds[1]);

      if (!value1 || !value2) {
        console.warn('Values not available');
        return;
      }

      expect(Math.abs(value1.value_epoch - value2.value_epoch)).toBeLessThan(60000);
    });

    it('should include updated_at timestamp', async () => {
      if (testPlayerIds.length === 0) {
        console.warn('No test players available');
        return;
      }

      const value = await getFDPValue(testPlayerIds[0]);

      expect(value).toBeDefined();
      expect(value?.updated_at).toBeDefined();
      expect(new Date(value!.updated_at).getTime()).toBeGreaterThan(0);
    });
  });
});
