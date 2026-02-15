/**
 * League Profile Resolver
 *
 * Converts raw league settings into a league_profile_id by:
 * 1. Computing a deterministic format_key from settings
 * 2. Looking up or creating the matching league_profile
 * 3. Returning the profile ID
 *
 * This ensures leagues with identical settings share the same values.
 */

import { supabase } from '../supabase';

export interface LeagueSettings {
  is_dynasty?: boolean;
  is_superflex?: boolean;
  te_premium?: number;
  ppr?: number;
  ppc?: number;
  idp_enabled?: boolean;
  idp_scoring_preset?: 'balanced' | 'tackleheavy' | 'bigplay' | null;
  starting_slots?: Record<string, number>;
  bench_slots?: number;
}

export interface LeagueProfile {
  id: string;
  name: string;
  format_key: string;
  is_dynasty: boolean;
  is_superflex: boolean;
  te_premium: number;
  ppr: number;
  ppc: number;
  idp_enabled: boolean;
  idp_scoring_preset: string | null;
  starting_slots: Record<string, number>;
  bench_slots: number;
}

/**
 * Generate deterministic format_key from settings
 */
export function generateFormatKey(settings: LeagueSettings): string {
  const {
    is_dynasty = true,
    is_superflex = true,
    te_premium = 0,
    ppr = 1,
    idp_enabled = false,
    idp_scoring_preset = null,
  } = settings;

  let key = is_dynasty ? 'dynasty' : 'redraft';

  // Add QB format
  key += is_superflex ? '_sf' : '_1qb';

  // Add PPR format
  if (ppr === 0) {
    key += '_standard';
  } else if (ppr === 0.5) {
    key += '_halfppr';
  } else if (ppr === 1) {
    key += '_ppr';
  } else {
    key += `_ppr${ppr.toString().replace('.', '_')}`;
  }

  // Add TE premium
  if (te_premium > 0) {
    key += '_tep';
  }

  // Add IDP
  if (idp_enabled && idp_scoring_preset) {
    key += `_idp_${idp_scoring_preset}`;
  }

  return key;
}

/**
 * Generate human-readable name from settings
 */
export function generateProfileName(settings: LeagueSettings): string {
  const {
    is_dynasty = true,
    is_superflex = true,
    te_premium = 0,
    ppr = 1,
    idp_enabled = false,
    idp_scoring_preset = null,
  } = settings;

  let name = is_dynasty ? 'Dynasty' : 'Redraft';

  // Add QB format
  name += is_superflex ? ' Superflex' : ' 1QB';

  // Add PPR format
  if (ppr === 0) {
    name += ' Standard';
  } else if (ppr === 0.5) {
    name += ' Half PPR';
  } else if (ppr === 1) {
    name += ' PPR';
  } else {
    name += ` ${ppr} PPR`;
  }

  // Add TE premium
  if (te_premium > 0) {
    name += ' TEP';
  }

  // Add IDP
  if (idp_enabled && idp_scoring_preset) {
    const idpName = idp_scoring_preset === 'tackleheavy' ? 'Tackle Heavy' :
                    idp_scoring_preset === 'bigplay' ? 'Big Play' :
                    'Balanced';
    name += ` IDP ${idpName}`;
  }

  return name;
}

/**
 * Get default starting slots for a league format
 */
function getDefaultStartingSlots(settings: LeagueSettings): Record<string, number> {
  const { is_superflex = true, idp_enabled = false } = settings;

  if (idp_enabled) {
    // IDP format
    return {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      SF: is_superflex ? 1 : 0,
      DL: 2,
      LB: 2,
      DB: 2,
    };
  } else {
    // Standard format
    return {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      FLEX: is_superflex ? 1 : 2,
      SF: is_superflex ? 1 : 0,
    };
  }
}

/**
 * Resolve league settings to a league_profile_id
 *
 * Flow:
 * 1. Generate format_key from settings
 * 2. Check if profile exists
 * 3. If not, create it (upsert)
 * 4. Return profile ID
 */
export async function resolveLeagueProfile(
  settings: LeagueSettings
): Promise<string> {
  const format_key = generateFormatKey(settings);

  // Try to find existing profile
  const { data: existing, error: fetchError } = await supabase
    .from('league_profiles')
    .select('id')
    .eq('format_key', format_key)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch league profile: ${fetchError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  // Profile doesn't exist, create it
  const name = generateProfileName(settings);
  const starting_slots = settings.starting_slots || getDefaultStartingSlots(settings);
  const bench_slots = settings.bench_slots || (settings.is_dynasty ? 20 : 7);

  const { data: newProfile, error: insertError } = await supabase
    .from('league_profiles')
    .insert({
      name,
      format_key,
      is_dynasty: settings.is_dynasty ?? true,
      is_superflex: settings.is_superflex ?? true,
      te_premium: settings.te_premium ?? 0,
      ppr: settings.ppr ?? 1,
      ppc: settings.ppc ?? 0,
      idp_enabled: settings.idp_enabled ?? false,
      idp_scoring_preset: settings.idp_scoring_preset || null,
      starting_slots,
      bench_slots,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to create league profile: ${insertError.message}`);
  }

  // Populate multipliers for new profile
  await populateProfileMultipliers(newProfile.id);

  return newProfile.id;
}

/**
 * Populate multipliers for a new profile
 */
async function populateProfileMultipliers(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('populate_profile_multipliers', {
    p_profile_id: profileId,
  });

  if (error) {
    console.error('Failed to populate profile multipliers:', error);
    // Don't throw - multipliers can be populated later
  }
}

/**
 * Get profile by ID
 */
export async function getLeagueProfile(profileId: string): Promise<LeagueProfile | null> {
  const { data, error } = await supabase
    .from('league_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch league profile: ${error.message}`);
  }

  return data;
}

/**
 * Get default league profile ID (dynasty_sf)
 */
export async function getDefaultLeagueProfileId(): Promise<string> {
  const { data, error } = await supabase.rpc('get_default_league_profile_id');

  if (error) {
    throw new Error(`Failed to get default profile: ${error.message}`);
  }

  return data;
}

/**
 * List all league profiles
 */
export async function listLeagueProfiles(): Promise<LeagueProfile[]> {
  const { data, error } = await supabase
    .from('league_profiles')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to list league profiles: ${error.message}`);
  }

  return data || [];
}

/**
 * Resolve Sleeper league settings to profile
 */
export async function resolveSleeperLeagueProfile(sleeperSettings: any): Promise<string> {
  const rosterSettings = sleeperSettings.roster_positions || [];
  const scoringSettings = sleeperSettings.scoring_settings || {};

  // Detect superflex
  const is_superflex = rosterSettings.includes('SUPER_FLEX') || rosterSettings.includes('SF');

  // Detect TE premium
  const te_ppr = scoringSettings.rec_te || scoringSettings.rec || 0;
  const wr_ppr = scoringSettings.rec || 0;
  const te_premium = te_ppr - wr_ppr;

  // Detect PPR
  const ppr = wr_ppr;

  // Detect points per carry
  const ppc = scoringSettings.rush_att || 0;

  // Detect IDP
  const idp_enabled = rosterSettings.some((pos: string) =>
    ['DL', 'LB', 'DB', 'DEF', 'IDP_FLEX'].includes(pos)
  );

  // Count starting slots
  const starting_slots: Record<string, number> = {};
  for (const pos of rosterSettings) {
    if (pos === 'BN' || pos === 'BENCH') continue; // Skip bench
    starting_slots[pos] = (starting_slots[pos] || 0) + 1;
  }

  const bench_slots = rosterSettings.filter((pos: string) =>
    pos === 'BN' || pos === 'BENCH'
  ).length;

  const settings: LeagueSettings = {
    is_dynasty: sleeperSettings.type === 2, // Sleeper: 0=redraft, 1=keeper, 2=dynasty
    is_superflex,
    te_premium,
    ppr,
    ppc,
    idp_enabled,
    idp_scoring_preset: idp_enabled ? 'balanced' : null, // Default to balanced
    starting_slots,
    bench_slots: bench_slots || 15,
  };

  return resolveLeagueProfile(settings);
}

/**
 * Resolve ESPN league settings to profile
 */
export async function resolveESPNLeagueProfile(espnSettings: any): Promise<string> {
  // ESPN settings parsing - implement based on ESPN API structure
  const settings: LeagueSettings = {
    is_dynasty: false, // ESPN doesn't have native dynasty support
    is_superflex: false, // Detect from roster settings
    te_premium: 0,
    ppr: 1, // Default
    ppc: 0,
    idp_enabled: false,
    idp_scoring_preset: null,
    starting_slots: {},
    bench_slots: 7,
  };

  return resolveLeagueProfile(settings);
}

/**
 * Resolve Yahoo league settings to profile
 */
export async function resolveYahooLeagueProfile(yahooSettings: any): Promise<string> {
  // Yahoo settings parsing - implement based on Yahoo API structure
  const settings: LeagueSettings = {
    is_dynasty: false, // Yahoo doesn't have native dynasty support
    is_superflex: false,
    te_premium: 0,
    ppr: 1,
    ppc: 0,
    idp_enabled: false,
    idp_scoring_preset: null,
    starting_slots: {},
    bench_slots: 7,
  };

  return resolveLeagueProfile(settings);
}
