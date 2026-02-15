/**
 * Profile Multipliers System
 *
 * Applies position-specific value multipliers based on league profile settings.
 * Multipliers account for:
 * - Superflex QB scarcity
 * - TE premium scoring
 * - IDP scoring preferences (tackle-heavy, big play, balanced)
 * - Deep starting lineup scarcity
 *
 * These multipliers are applied DURING value generation, not at query time.
 */

import { supabase } from '../supabase';
import type { LeagueProfile } from '../league/resolveLeagueProfile';

export interface PositionMultiplier {
  position: string;
  multiplier: number;
  reason: string;
}

/**
 * Get multipliers for a league profile
 */
export async function getProfileMultipliers(
  profileId: string
): Promise<Map<string, PositionMultiplier>> {
  const { data, error } = await supabase
    .from('league_profile_multipliers')
    .select('*')
    .eq('league_profile_id', profileId);

  if (error) {
    throw new Error(`Failed to fetch profile multipliers: ${error.message}`);
  }

  const multipliers = new Map<string, PositionMultiplier>();
  for (const row of data || []) {
    multipliers.set(row.position, {
      position: row.position,
      multiplier: row.multiplier,
      reason: row.reason || '',
    });
  }

  return multipliers;
}

/**
 * Calculate multipliers for a profile based on settings
 */
export function calculateMultipliers(profile: LeagueProfile): PositionMultiplier[] {
  const multipliers: PositionMultiplier[] = [];

  // 1. QB Multiplier (Superflex boost)
  if (profile.is_superflex) {
    multipliers.push({
      position: 'QB',
      multiplier: 1.25,
      reason: 'Superflex scarcity boost',
    });
  } else {
    multipliers.push({
      position: 'QB',
      multiplier: 1.0,
      reason: 'Standard 1QB',
    });
  }

  // 2. RB Multiplier (Position scarcity)
  const rbCount = profile.starting_slots.RB || 2;
  let rbMultiplier = 1.05; // Base scarcity

  // Deep starting lineups increase scarcity
  if (rbCount >= 3) {
    rbMultiplier += 0.05; // +5% for 3+ starting RBs
  }

  multipliers.push({
    position: 'RB',
    multiplier: rbMultiplier,
    reason: rbCount >= 3
      ? 'Position scarcity (deep lineups)'
      : 'Position scarcity',
  });

  // 3. WR Multiplier (Baseline)
  const wrCount = profile.starting_slots.WR || 3;
  let wrMultiplier = 1.0; // Baseline

  // Deep starting lineups increase scarcity slightly
  if (wrCount >= 4) {
    wrMultiplier += 0.05; // +5% for 4+ starting WRs
  }

  multipliers.push({
    position: 'WR',
    multiplier: wrMultiplier,
    reason: wrCount >= 4
      ? 'Baseline position (deep lineups)'
      : 'Baseline position',
  });

  // 4. TE Multiplier (TE Premium boost)
  let teMultiplier = 1.0;

  if (profile.te_premium > 0) {
    // TE premium: +30% per PPR point, capped at +25%
    const teBoost = Math.min(profile.te_premium * 0.30, 0.25);
    teMultiplier += teBoost;

    multipliers.push({
      position: 'TE',
      multiplier: teMultiplier,
      reason: `TE premium boost (${profile.te_premium} PPR)`,
    });
  } else {
    multipliers.push({
      position: 'TE',
      multiplier: teMultiplier,
      reason: 'Standard TE',
    });
  }

  // 5. IDP Multipliers (if enabled)
  if (profile.idp_enabled) {
    const idpPreset = profile.idp_scoring_preset;

    switch (idpPreset) {
      case 'tackleheavy':
        // Tackle-heavy scoring favors LBs
        multipliers.push(
          {
            position: 'LB',
            multiplier: 1.10,
            reason: 'IDP: Tackle-heavy scoring favors LBs',
          },
          {
            position: 'DB',
            multiplier: 0.95,
            reason: 'IDP: Tackle-heavy scoring',
          },
          {
            position: 'DL',
            multiplier: 1.00,
            reason: 'IDP: Tackle-heavy scoring',
          }
        );
        break;

      case 'bigplay':
        // Big play scoring favors pass rushers (DL)
        multipliers.push(
          {
            position: 'LB',
            multiplier: 0.95,
            reason: 'IDP: Big play scoring',
          },
          {
            position: 'DB',
            multiplier: 0.90,
            reason: 'IDP: Big play scoring',
          },
          {
            position: 'DL',
            multiplier: 1.15,
            reason: 'IDP: Big play scoring favors DL',
          }
        );
        break;

      default:
        // Balanced IDP scoring
        multipliers.push(
          {
            position: 'LB',
            multiplier: 1.00,
            reason: 'IDP: Balanced scoring',
          },
          {
            position: 'DB',
            multiplier: 1.00,
            reason: 'IDP: Balanced scoring',
          },
          {
            position: 'DL',
            multiplier: 1.00,
            reason: 'IDP: Balanced scoring',
          }
        );
        break;
    }
  }

  return multipliers;
}

/**
 * Apply multiplier to a player value
 */
export function applyMultiplier(
  baseValue: number,
  position: string,
  multipliers: Map<string, PositionMultiplier>
): number {
  const multiplier = multipliers.get(position);
  if (!multiplier) {
    return baseValue; // No multiplier for this position
  }

  return Math.round(baseValue * multiplier.multiplier);
}

/**
 * Update multipliers for a profile in the database
 */
export async function updateProfileMultipliers(
  profileId: string,
  multipliers: PositionMultiplier[]
): Promise<void> {
  // Delete existing multipliers
  const { error: deleteError } = await supabase
    .from('league_profile_multipliers')
    .delete()
    .eq('league_profile_id', profileId);

  if (deleteError) {
    throw new Error(`Failed to delete old multipliers: ${deleteError.message}`);
  }

  // Insert new multipliers
  const rows = multipliers.map((m) => ({
    league_profile_id: profileId,
    position: m.position,
    multiplier: m.multiplier,
    reason: m.reason,
  }));

  const { error: insertError } = await supabase
    .from('league_profile_multipliers')
    .insert(rows);

  if (insertError) {
    throw new Error(`Failed to insert multipliers: ${insertError.message}`);
  }
}

/**
 * Recalculate and update multipliers for all profiles
 */
export async function recalculateAllMultipliers(): Promise<void> {
  // Get all profiles
  const { data: profiles, error: fetchError } = await supabase
    .from('league_profiles')
    .select('*');

  if (fetchError) {
    throw new Error(`Failed to fetch profiles: ${fetchError.message}`);
  }

  // Recalculate multipliers for each profile
  for (const profile of profiles || []) {
    const multipliers = calculateMultipliers(profile);
    await updateProfileMultipliers(profile.id, multipliers);
  }
}

/**
 * Get multiplier for a specific position
 */
export function getPositionMultiplier(
  position: string,
  multipliers: Map<string, PositionMultiplier>
): number {
  const multiplier = multipliers.get(position);
  return multiplier ? multiplier.multiplier : 1.0;
}

/**
 * Get multiplier breakdown for display
 */
export function getMultiplierBreakdown(
  position: string,
  multipliers: Map<string, PositionMultiplier>
): {
  base: number;
  multiplier: number;
  reason: string;
} {
  const multiplier = multipliers.get(position);
  if (!multiplier) {
    return {
      base: 1.0,
      multiplier: 1.0,
      reason: 'No adjustment',
    };
  }

  return {
    base: 1.0,
    multiplier: multiplier.multiplier,
    reason: multiplier.reason,
  };
}

/**
 * Calculate expected value with multiplier
 */
export function calculateAdjustedValue(
  baseValue: number,
  position: string,
  profileId: string,
  multipliers: Map<string, PositionMultiplier>
): {
  baseValue: number;
  adjustedValue: number;
  multiplier: number;
  reason: string;
} {
  const mult = multipliers.get(position);
  if (!mult) {
    return {
      baseValue,
      adjustedValue: baseValue,
      multiplier: 1.0,
      reason: 'No adjustment',
    };
  }

  const adjustedValue = Math.round(baseValue * mult.multiplier);

  return {
    baseValue,
    adjustedValue,
    multiplier: mult.multiplier,
    reason: mult.reason,
  };
}

/**
 * Get all multiplier reasons for display
 */
export function getMultiplierReasons(
  multipliers: Map<string, PositionMultiplier>
): Record<string, string> {
  const reasons: Record<string, string> = {};

  for (const [position, mult] of multipliers.entries()) {
    if (mult.multiplier !== 1.0) {
      reasons[position] = mult.reason;
    }
  }

  return reasons;
}
