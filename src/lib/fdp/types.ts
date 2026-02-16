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
 * Use sparingly - prefer formatFDPValue()
 *
 * WARNING: Do NOT perform arithmetic on this value
 * FDP values are immutable and cannot be modified
 */
export function unwrapFDPValue(value: FDPValue): number {
  return value as number;
}

/**
 * Format FDP value for display
 * This is the ONLY legal way to display FDP values
 *
 * DO NOT use:
 * - Math.round(fdp.value)
 * - fdp.value.toFixed()
 * - fdp.value / 100
 * - fdp.value * scale
 *
 * FDP values are immutable and cannot be transformed
 */
export function formatFDPValue(value: FDPValue, options?: {
  style?: 'short' | 'long';
  decimals?: number;
}): string {
  const num = unwrapFDPValue(value);
  const style = options?.style || 'long';

  if (style === 'short') {
    if (num >= 10000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  }

  return num.toLocaleString(undefined, {
    maximumFractionDigits: options?.decimals ?? 0,
  });
}

/**
 * Format FDP value as currency
 */
export function formatFDPValueAsCurrency(value: FDPValue): string {
  const num = unwrapFDPValue(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format FDP tier for display
 */
export function formatFDPTier(tier: FDPTier): string {
  const num = tier as number;

  const labels: Record<number, string> = {
    1: 'Elite',
    2: 'Great',
    3: 'Good',
    4: 'Solid',
    5: 'Depth',
  };

  return labels[num] || 'Unranked';
}

/**
 * Format FDP rank for display
 */
export function formatFDPRank(rank: FDPRank, position?: boolean): string {
  const num = rank as number;

  if (num >= 999) {
    return 'Unranked';
  }

  return position ? `#${num}` : `Overall #${num}`;
}

/**
 * Compare two FDP values
 * Returns positive if a > b, negative if a < b, zero if equal
 *
 * NOTE: This is for sorting/comparison only
 * DO NOT use for arithmetic or value calculations
 */
export function compareFDPValues(a: FDPValue, b: FDPValue): number {
  return unwrapFDPValue(a) - unwrapFDPValue(b);
}

/**
 * Get difference between two FDP values (for trade analysis)
 * Returns raw number difference
 *
 * NOTE: This is for display only
 * DO NOT use result for further calculations
 */
export function getFDPValueDifference(a: FDPValue, b: FDPValue): number {
  return Math.abs(unwrapFDPValue(a) - unwrapFDPValue(b));
}

/**
 * Check if FDP value is stale (> 48 hours old)
 */
export function isFDPValueStale(bundle: FDPValueBundle): boolean {
  const now = Date.now();
  const updated = new Date(bundle.updated_at).getTime();
  const ageHours = (now - updated) / (1000 * 60 * 60);

  return ageHours > 48;
}

/**
 * Get FDP value age in human-readable format
 */
export function getFDPValueAge(bundle: FDPValueBundle): string {
  const now = Date.now();
  const updated = new Date(bundle.updated_at).getTime();
  const ageMs = now - updated;

  const minutes = Math.floor(ageMs / (1000 * 60));
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}
