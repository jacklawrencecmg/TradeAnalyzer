/**
 * FDP Branded Types
 *
 * Type-level enforcement that prevents UI from rendering non-FDP values.
 *
 * These branded types make it IMPOSSIBLE to pass raw numbers as player values.
 * TypeScript will error unless values come from getFDPValue().
 *
 * DO NOT export the branding helpers outside this module.
 * Only getFDPValue() should create branded types.
 */

/**
 * Branded player value from FDP canonical source
 * Cannot be created from raw numbers - must come from getFDPValue()
 */
export type FDPValue = number & { readonly __brand: 'FDPValue' };

/**
 * Branded tier assignment from FDP
 */
export type FDPTier = number & { readonly __brand: 'FDPTier' };

/**
 * Branded overall rank from FDP
 */
export type FDPRank = number & { readonly __brand: 'FDPRank' };

/**
 * Branded epoch identifier for cache validation
 */
export type FDPEpoch = string & { readonly __brand: 'FDPEpoch' };

/**
 * Complete FDP value bundle
 * This is the ONLY type UI components should accept for player values
 */
export interface FDPValueBundle {
  readonly player_id: string;
  readonly player_name: string;
  readonly position: string;
  readonly team: string | null;
  readonly value: FDPValue;
  readonly tier: FDPTier;
  readonly overall_rank: FDPRank;
  readonly pos_rank: FDPRank;
  readonly value_epoch: FDPEpoch;
  readonly updated_at: string;
  readonly adjustments?: {
    base_value: number;
    market_anchor: number;
    scarcity: number;
    league_context: number;
    final_value: number;
  };
}

/**
 * Collection of FDP values keyed by player_id
 * For batch operations and rosters
 */
export type FDPValueMap = ReadonlyMap<string, FDPValueBundle>;

/**
 * FDP Provider interface for dependency injection
 * Trade/advice engines should accept this, not raw values
 */
export interface FDPProvider {
  /**
   * Get single player value
   */
  getValue(playerId: string): Promise<FDPValueBundle | null>;

  /**
   * Get batch of player values
   */
  getValues(playerIds: string[]): Promise<FDPValueMap>;

  /**
   * Get league profile context
   */
  getLeagueProfile(): {
    league_profile_id: string | null;
    format: string;
  };
}

/**
 * Raw database response (before branding)
 * Internal use only - never expose to UI
 */
export interface FDPRawResponse {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  base_value: number;
  adjusted_value: number;
  market_value: number;
  tier: string;
  rank_overall: number;
  rank_position: number;
  value_epoch_id: string;
  updated_at: string;
  league_profile_id?: string;
  format?: string;
  confidence_score?: number;
}

/**
 * Type guard to check if value is properly branded
 */
export function isFDPValueBundle(value: unknown): value is FDPValueBundle {
  if (!value || typeof value !== 'object') return false;

  const v = value as any;

  return (
    typeof v.player_id === 'string' &&
    typeof v.value === 'number' &&
    typeof v.tier === 'number' &&
    typeof v.overall_rank === 'number' &&
    typeof v.pos_rank === 'number' &&
    typeof v.value_epoch === 'string' &&
    typeof v.updated_at === 'string'
  );
}

/**
 * Extract raw number from branded value (for display only)
 * Use sparingly - prefer displaying entire bundle
 */
export function unwrapFDPValue(value: FDPValue): number {
  return value as number;
}

/**
 * Format FDP value for display
 */
export function formatFDPValue(value: FDPValue): string {
  const num = unwrapFDPValue(value);
  return num.toLocaleString();
}

/**
 * Compare two FDP values
 */
export function compareFDPValues(a: FDPValue, b: FDPValue): number {
  return unwrapFDPValue(a) - unwrapFDPValue(b);
}
