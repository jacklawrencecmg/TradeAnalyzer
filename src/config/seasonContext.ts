/**
 * Season Context Configuration
 *
 * Defines the current season state and value epoch.
 * This is the authoritative source for what season data should be used.
 *
 * CRITICAL: Any value snapshot captured before invalidate_before is STALE and must be rejected.
 */

export const SEASON_CONTEXT = {
  /**
   * Current league year
   */
  league_year: 2026,

  /**
   * Last completed NFL season
   * Values should reflect performance from this season
   */
  last_completed_season: 2025,

  /**
   * Current season phase
   * preseason | regular | postseason | offseason
   */
  phase: 'postseason' as const,

  /**
   * Value epoch identifier
   * Changes when we need to invalidate all previous values
   */
  value_epoch: 'POST_2025',

  /**
   * Hard cutoff date - any values before this are invalid
   * Format: YYYY-MM-DD
   */
  invalidate_before: '2025-02-01',

  /**
   * When the last season started (for season stats queries)
   */
  season_start_date: '2025-09-05',

  /**
   * When the last season ended
   */
  season_end_date: '2026-02-02',

  /**
   * Regular season weeks (for stats weighting)
   */
  regular_season_weeks: 18,

  /**
   * Playoff weeks (for additional weighting)
   */
  playoff_weeks: 4,
} as const;

/**
 * Value calculation weights for POST_2025 epoch
 */
export const VALUE_WEIGHTS = {
  /**
   * 2025 season production weight (≥60% as required)
   */
  season_production: 0.65,

  /**
   * Opportunity metrics (snap share, target share, route participation)
   */
  opportunity_metrics: 0.20,

  /**
   * Age curve adjustment
   */
  age_curve: 0.10,

  /**
   * Depth chart and situation
   */
  situation: 0.05,
} as const;

/**
 * Check if a date is before the invalidation cutoff
 */
export function isStaleValue(capturedAt: string | Date): boolean {
  const date = typeof capturedAt === 'string' ? new Date(capturedAt) : capturedAt;
  const cutoff = new Date(SEASON_CONTEXT.invalidate_before);
  return date < cutoff;
}

/**
 * Get the current value epoch identifier
 */
export function getCurrentEpoch(): string {
  return SEASON_CONTEXT.value_epoch;
}

/**
 * Check if we're in a period where values need to be rebuilt
 */
export function needsSeasonalRebuild(): boolean {
  const now = new Date();
  const seasonEnd = new Date(SEASON_CONTEXT.season_end_date);

  // If we're within 30 days after season end, we need fresh values
  const daysSinceSeasonEnd = (now.getTime() - seasonEnd.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceSeasonEnd < 30 && daysSinceSeasonEnd >= 0;
}

/**
 * Calculate which season's data to use for a player
 */
export function getRelevantSeason(): number {
  return SEASON_CONTEXT.last_completed_season;
}

/**
 * Get human-readable season context
 */
export function getSeasonContextSummary(): string {
  return `${SEASON_CONTEXT.value_epoch} (${SEASON_CONTEXT.last_completed_season} Season Complete)`;
}

/**
 * Season phase multipliers for different metrics
 */
export const PHASE_MULTIPLIERS = {
  preseason: {
    projection_weight: 0.7,
    prior_season_weight: 0.3,
  },
  regular: {
    projection_weight: 0.4,
    prior_season_weight: 0.6,
  },
  postseason: {
    projection_weight: 0.2,
    prior_season_weight: 0.8,
  },
  offseason: {
    projection_weight: 0.3,
    prior_season_weight: 0.7,
  },
} as const;

/**
 * Get current phase multipliers
 */
export function getCurrentPhaseMultipliers() {
  return PHASE_MULTIPLIERS[SEASON_CONTEXT.phase];
}
