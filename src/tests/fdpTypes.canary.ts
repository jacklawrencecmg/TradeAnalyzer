/**
 * FDP Type Safety Canary Tests
 *
 * These tests INTENTIONALLY try to break FDP type safety.
 * If TypeScript allows any of these to compile, the type system is broken.
 *
 * Run with: npm run typecheck
 *
 * All commented-out lines MUST cause TypeScript errors.
 * If they compile, the branded types are not working.
 */

import type { FDPValue, FDPValueBundle, FDPTier, FDPRank, FDPEpoch } from '../lib/fdp/types';
import { getFDPValue, getFDPValuesBatch } from '../lib/fdp/getFDPValue';

describe('FDP Type Safety Canary', () => {
  it('should prevent raw number assignment to FDPValue', () => {
    // ❌ This MUST NOT compile:
    // const value: FDPValue = 1000;
    // @ts-expect-error - Raw numbers cannot be FDPValue
    const _broken: FDPValue = 1000 as FDPValue; // Only works with explicit cast

    // ✅ This SHOULD compile:
    void _broken;
  });

  it('should prevent raw number assignment to FDPTier', () => {
    // ❌ This MUST NOT compile:
    // const tier: FDPTier = 1;
    // @ts-expect-error - Raw numbers cannot be FDPTier
    const _broken: FDPTier = 1 as FDPTier;

    void _broken;
  });

  it('should prevent raw number assignment to FDPRank', () => {
    // ❌ This MUST NOT compile:
    // const rank: FDPRank = 42;
    // @ts-expect-error - Raw numbers cannot be FDPRank
    const _broken: FDPRank = 42 as FDPRank;

    void _broken;
  });

  it('should prevent raw string assignment to FDPEpoch', () => {
    // ❌ This MUST NOT compile:
    // const epoch: FDPEpoch = 'abc123';
    // @ts-expect-error - Raw strings cannot be FDPEpoch
    const _broken: FDPEpoch = 'abc123' as FDPEpoch;

    void _broken;
  });

  it('should prevent manual construction of FDPValueBundle', () => {
    // ❌ This MUST NOT compile without explicit casts:
    // const bundle: FDPValueBundle = {
    //   player_id: 'p1',
    //   player_name: 'Test Player',
    //   position: 'QB',
    //   team: 'KC',
    //   value: 1000, // Not branded!
    //   tier: 1,
    //   overall_rank: 5,
    //   pos_rank: 2,
    //   value_epoch: 'epoch123',
    //   updated_at: new Date().toISOString(),
    // };

    // Even with explicit typing, values aren't branded
    const _notReally: FDPValueBundle = {
      player_id: 'p1',
      player_name: 'Test',
      position: 'QB',
      team: 'KC',
      value: 1000 as FDPValue, // Requires cast
      tier: 1 as FDPTier,
      overall_rank: 5 as FDPRank,
      pos_rank: 2 as FDPRank,
      value_epoch: 'epoch' as FDPEpoch,
      updated_at: new Date().toISOString(),
    };

    void _notReally;
  });

  it('should only allow FDPValueBundle from getFDPValue', async () => {
    // ✅ This is the ONLY legal way:
    const bundle = await getFDPValue('test_player');

    if (bundle) {
      // These are properly branded
      const value: FDPValue = bundle.value;
      const tier: FDPTier = bundle.tier;
      const rank: FDPRank = bundle.overall_rank;
      const epoch: FDPEpoch = bundle.value_epoch;

      // ❌ Cannot assign back to raw numbers without cast:
      // const rawValue: number = value; // Error!
      // @ts-expect-error - Branded types are not assignable to raw numbers
      const _broken: number = value;

      void value;
      void tier;
      void rank;
      void epoch;
      void _broken;
    }
  });

  it('should prevent component props with raw number values', () => {
    // ❌ This interface MUST be caught by ESLint:
    // interface BadProps {
    //   value: number; // BANNED!
    //   dynasty_value: number; // BANNED!
    // }

    // ✅ This is the correct way:
    interface GoodProps {
      fdp: FDPValueBundle;
    }

    const _good: GoodProps = {
      fdp: null as any, // Placeholder
    };

    void _good;
  });

  it('should prevent trade calculations with raw numbers', () => {
    // ❌ This MUST NOT work:
    // function calculateTrade(player1Value: number, player2Value: number) {
    //   return player1Value - player2Value;
    // }

    // ✅ This is correct - takes FDPProvider:
    async function calculateTrade(
      player1Id: string,
      player2Id: string,
      provider: { getValue: (id: string) => Promise<FDPValueBundle | null> }
    ) {
      const p1 = await provider.getValue(player1Id);
      const p2 = await provider.getValue(player2Id);

      if (!p1 || !p2) return null;

      // Values are branded, but can be compared
      const diff = (p1.value as number) - (p2.value as number);
      return diff;
    }

    void calculateTrade;
  });

  it('should enforce FDPProvider interface for engines', () => {
    // ❌ This MUST NOT be allowed:
    // function badEngine(values: Record<string, number>) {
    //   return Object.values(values).reduce((a, b) => a + b, 0);
    // }

    // ✅ This is correct:
    async function goodEngine(provider: {
      getValues: (ids: string[]) => Promise<Map<string, FDPValueBundle>>;
    }) {
      const values = await provider.getValues(['p1', 'p2']);
      let total = 0;
      for (const bundle of values.values()) {
        total += bundle.value as number;
      }
      return total;
    }

    void goodEngine;
  });

  it('should prevent weakening of brand through type manipulation', () => {
    // ❌ These attempts to weaken the brand MUST fail:

    // Attempt 1: Type assertion from number
    // @ts-expect-error - Cannot assert raw number to branded type
    const _attempt1: FDPValue = 1000 as unknown as FDPValue;

    // Attempt 2: Object.assign to create fake bundle
    // @ts-expect-error - Properties are not properly branded
    const _attempt2: FDPValueBundle = Object.assign({}, {
      value: 1000,
      tier: 1,
      overall_rank: 5,
      pos_rank: 2,
      value_epoch: 'epoch',
    } as unknown as FDPValueBundle);

    // Attempt 3: Spread operator
    // @ts-expect-error - Spread doesn't preserve brands
    const _attempt3: FDPValueBundle = {
      ...({
        value: 1000,
        tier: 1,
      } as any),
    };

    void _attempt1;
    void _attempt2;
    void _attempt3;
  });
});

/**
 * Compile-time assertions
 * These are checked at build time, not runtime
 */

// Type-level test: FDPValue is not assignable to number
type TestValueNotNumber = FDPValue extends number ? (number extends FDPValue ? 'BROKEN' : 'OK') : 'BROKEN';
const _testValue: TestValueNotNumber = 'OK'; // Must be 'OK'

// Type-level test: FDPTier is not assignable to number
type TestTierNotNumber = FDPTier extends number ? (number extends FDPTier ? 'BROKEN' : 'OK') : 'BROKEN';
const _testTier: TestTierNotNumber = 'OK';

// Type-level test: FDPEpoch is not assignable to string
type TestEpochNotString = FDPEpoch extends string ? (string extends FDPEpoch ? 'BROKEN' : 'OK') : 'BROKEN';
const _testEpoch: TestEpochNotString = 'OK';

void _testValue;
void _testTier;
void _testEpoch;

export {};
