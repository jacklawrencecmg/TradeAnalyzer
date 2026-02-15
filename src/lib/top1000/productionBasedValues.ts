/**
 * Production-Based Value Calculations (POST_2025 Epoch)
 *
 * Calculates player values based on 2025 season performance.
 * Replaces preseason ADP-based priors with actual production data.
 *
 * Weights:
 * - 65% Season Production (fantasy points, yards, TDs)
 * - 20% Opportunity Metrics (snap %, targets, carries, routes)
 * - 10% Age Curve
 * - 5% Situation (depth chart, team context)
 */

import { SEASON_CONTEXT, VALUE_WEIGHTS, getCurrentEpoch } from '../../config/seasonContext';

export interface PlayerProductionData {
  // Player identity
  id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  age: number | null;
  years_exp: number | null;

  // 2025 Season Production (65% weight)
  fantasy_points_ppr?: number;      // Total PPR fantasy points
  fantasy_points_per_game?: number; // PPR points per game
  games_played?: number;
  yards?: number;                   // Total yards (rushing + receiving)
  touchdowns?: number;              // Total TDs
  receptions?: number;              // Catches (WR/TE/RB)
  targets?: number;                 // Targets (WR/TE/RB)
  carries?: number;                 // Rushes (RB/QB)
  passing_yards?: number;           // QB passing yards
  passing_tds?: number;             // QB passing TDs
  interceptions?: number;           // QB interceptions

  // Opportunity Metrics (20% weight)
  snap_share?: number;              // % of team snaps (0-100)
  target_share?: number;            // % of team targets (0-100)
  route_participation?: number;     // % of routes run when pass plays happen (0-100)
  red_zone_touches?: number;        // Touches inside 20-yard line
  air_yards_share?: number;         // % of team air yards (WR/TE)

  // Situation (5% weight)
  depth_chart_position?: number;
  status: string;
  injury_history?: 'clean' | 'minor' | 'significant';

  // Team context
  team_pass_rate?: number;          // Team's pass rate rank (1-32)
  team_offensive_rank?: number;     // Team's offensive rank (1-32)

  // Other
  birthdate: string | null;
}

export interface ProductionCalculatedValues {
  dynasty_value: number;
  redraft_value: number;
  production_score: number;
  opportunity_score: number;
  age_score: number;
  situation_score: number;
  notes: string[];
  value_epoch: string;
}

/**
 * Calculate dynasty and redraft values based on 2025 production
 */
export function calculateProductionBasedValues(
  player: PlayerProductionData
): ProductionCalculatedValues {
  const notes: string[] = [];
  const position = player.player_position;

  // Validate we have production data
  if (!player.fantasy_points_ppr && !player.yards && !player.touchdowns) {
    notes.push('WARNING: No production data available, using fallback calculation');
    return calculateFallbackValues(player, notes);
  }

  // Component 1: Season Production Score (65% weight)
  const productionScore = calculateProductionScore(player, notes);

  // Component 2: Opportunity Score (20% weight)
  const opportunityScore = calculateOpportunityScore(player, notes);

  // Component 3: Age Score (10% weight)
  const ageScore = calculateAgeScore(player, notes);

  // Component 4: Situation Score (5% weight)
  const situationScore = calculateSituationScore(player, notes);

  // Combine scores with weights
  const dynastyRaw =
    productionScore * VALUE_WEIGHTS.season_production +
    opportunityScore * VALUE_WEIGHTS.opportunity_metrics +
    ageScore * VALUE_WEIGHTS.age_curve +
    situationScore * VALUE_WEIGHTS.situation;

  // Redraft: Production matters more, age matters less
  const redraftRaw =
    productionScore * 0.75 +
    opportunityScore * 0.20 +
    ageScore * 0.03 +
    situationScore * 0.02;

  // Scale to 0-10000 range and clamp
  const dynastyValue = Math.max(0, Math.min(10000, Math.round(dynastyRaw)));
  const redraftValue = Math.max(0, Math.min(10000, Math.round(redraftRaw)));

  notes.push(
    `Prod:${productionScore.toFixed(0)} Opp:${opportunityScore.toFixed(0)} Age:${ageScore.toFixed(0)} Sit:${situationScore.toFixed(0)}`
  );

  return {
    dynasty_value: dynastyValue,
    redraft_value: redraftValue,
    production_score: productionScore,
    opportunity_score: opportunityScore,
    age_score: ageScore,
    situation_score: situationScore,
    notes,
    value_epoch: getCurrentEpoch(),
  };
}

/**
 * Calculate production score from 2025 season stats
 * Returns 0-10000 range
 */
function calculateProductionScore(player: PlayerProductionData, notes: string[]): number {
  const position = player.player_position;
  const gamesPlayed = player.games_played || 17;

  // Get per-game fantasy points if available
  const pointsPerGame = player.fantasy_points_per_game || (player.fantasy_points_ppr || 0) / gamesPlayed;

  if (pointsPerGame === 0) {
    notes.push('No fantasy points recorded');
    return 1000; // Minimum floor for rostered players
  }

  notes.push(`${pointsPerGame.toFixed(1)} PPG`);

  // Position-specific scoring tiers (based on 2025 performance)
  let score = 0;

  if (position === 'QB') {
    // QB tiers (PPR pts/game)
    if (pointsPerGame >= 25) score = 9500; // Elite QB1
    else if (pointsPerGame >= 22) score = 8500; // High QB1
    else if (pointsPerGame >= 20) score = 7500; // Low QB1
    else if (pointsPerGame >= 18) score = 6500; // High QB2
    else if (pointsPerGame >= 15) score = 5000; // Low QB2
    else if (pointsPerGame >= 12) score = 3500; // Backup
    else score = 2000; // Deep backup

    // QB passing volume bonus
    if (player.passing_yards && player.passing_yards > 4500) {
      score += 300;
      notes.push(`High volume: ${player.passing_yards}yd`);
    }
  } else if (position === 'RB') {
    // RB tiers (PPR pts/game)
    if (pointsPerGame >= 20) score = 9500; // Elite RB1 (CMC, Bijan tier)
    else if (pointsPerGame >= 17) score = 8500; // High RB1
    else if (pointsPerGame >= 15) score = 7500; // Low RB1
    else if (pointsPerGame >= 13) score = 6500; // High RB2
    else if (pointsPerGame >= 11) score = 5500; // Low RB2
    else if (pointsPerGame >= 9) score = 4000; // Flex/RB3
    else if (pointsPerGame >= 7) score = 2500; // Handcuff
    else score = 1500; // Deep depth

    // Workhorse bonus (high carries + catches)
    const touches = (player.carries || 0) + (player.receptions || 0);
    if (touches > 300) {
      score += 500;
      notes.push(`Workhorse: ${touches} touches`);
    }
  } else if (position === 'WR') {
    // WR tiers (PPR pts/game) - ADJUSTED FOR 2025 BREAKOUTS
    if (pointsPerGame >= 18) score = 9500; // Elite WR1 (CeeDee, Tyreek tier)
    else if (pointsPerGame >= 16) score = 9000; // High WR1 (JSN, Amon-Ra tier)
    else if (pointsPerGame >= 14) score = 8000; // Low WR1
    else if (pointsPerGame >= 12) score = 7000; // High WR2
    else if (pointsPerGame >= 10) score = 6000; // Mid WR2
    else if (pointsPerGame >= 8) score = 4500; // Low WR2/WR3
    else if (pointsPerGame >= 6) score = 3000; // Flex
    else score = 1500; // Deep depth

    // Reception volume bonus (PPR boost)
    if (player.receptions && player.receptions > 100) {
      score += 400;
      notes.push(`High volume: ${player.receptions} rec`);
    }

    // Big-play ability
    if (player.yards && player.yards > 1400) {
      score += 300;
      notes.push(`Big plays: ${player.yards}yd`);
    }
  } else if (position === 'TE') {
    // TE tiers (PPR pts/game)
    if (pointsPerGame >= 15) score = 8500; // Elite TE1 (rare tier)
    else if (pointsPerGame >= 12) score = 7500; // High TE1
    else if (pointsPerGame >= 10) score = 6500; // Low TE1
    else if (pointsPerGame >= 8) score = 5000; // TE2
    else if (pointsPerGame >= 6) score = 3500; // Streamer
    else score = 2000; // Deep depth

    // TE target share bonus
    if (player.targets && player.targets > 100) {
      score += 350;
      notes.push(`Volume TE: ${player.targets} tgt`);
    }
  } else if (['DL', 'LB', 'DB'].includes(position)) {
    // IDP scoring (simplified - would need IDP-specific stats)
    // For now, scale based on position typical ranges
    const idpTier =
      position === 'LB'
        ? [12, 10, 8, 6, 4] // LB tiers
        : position === 'DL'
        ? [10, 8, 6, 4, 2] // DL tiers
        : [8, 6, 4, 2, 1]; // DB tiers

    if (pointsPerGame >= idpTier[0]) score = 5000;
    else if (pointsPerGame >= idpTier[1]) score = 4000;
    else if (pointsPerGame >= idpTier[2]) score = 3000;
    else if (pointsPerGame >= idpTier[3]) score = 2000;
    else score = 1000;
  } else {
    // Unknown position
    score = 2000;
  }

  return score;
}

/**
 * Calculate opportunity score from usage metrics
 * Returns 0-10000 range
 */
function calculateOpportunityScore(player: PlayerProductionData, notes: string[]): number {
  let score = 5000; // Start at baseline

  const position = player.player_position;

  // Snap share is critical for all positions
  if (player.snap_share !== undefined) {
    if (player.snap_share >= 85) {
      score += 2000;
      notes.push(`Elite snaps: ${player.snap_share.toFixed(0)}%`);
    } else if (player.snap_share >= 70) {
      score += 1500;
      notes.push(`High snaps: ${player.snap_share.toFixed(0)}%`);
    } else if (player.snap_share >= 50) {
      score += 800;
      notes.push(`Solid snaps: ${player.snap_share.toFixed(0)}%`);
    } else if (player.snap_share >= 30) {
      score += 200;
      notes.push(`Part-time: ${player.snap_share.toFixed(0)}%`);
    } else {
      score -= 500;
      notes.push(`Low snaps: ${player.snap_share.toFixed(0)}%`);
    }
  }

  // Target/carry share for skill positions
  if (['WR', 'TE', 'RB'].includes(position)) {
    if (player.target_share !== undefined && player.target_share > 0) {
      if (player.target_share >= 25) {
        score += 1500;
        notes.push(`Dominant target share: ${player.target_share.toFixed(0)}%`);
      } else if (player.target_share >= 20) {
        score += 1000;
      } else if (player.target_share >= 15) {
        score += 500;
      }
    }
  }

  // Route participation for WR/TE
  if (['WR', 'TE'].includes(position) && player.route_participation !== undefined) {
    if (player.route_participation >= 90) {
      score += 800;
      notes.push(`Always on field: ${player.route_participation.toFixed(0)}% routes`);
    } else if (player.route_participation >= 75) {
      score += 400;
    }
  }

  // Red zone usage
  if (player.red_zone_touches !== undefined && player.red_zone_touches > 20) {
    score += 600;
    notes.push(`RZ threat: ${player.red_zone_touches} touches`);
  }

  return Math.max(0, Math.min(10000, score));
}

/**
 * Calculate age curve score
 * Returns 0-10000 range, with penalties/bonuses based on position-specific curves
 */
function calculateAgeScore(player: PlayerProductionData, notes: string[]): number {
  const age = player.age;
  if (!age) return 5000; // Neutral if age unknown

  const position = player.player_position;
  let score = 5000; // Start at neutral

  if (position === 'RB') {
    // RB age curve is harsh
    if (age <= 22) {
      score = 8500;
      notes.push('Young RB upside');
    } else if (age <= 24) {
      score = 7500;
    } else if (age <= 26) {
      score = 6000;
    } else if (age <= 28) {
      score = 4000;
      notes.push('Age concern for RB');
    } else {
      score = 2000;
      notes.push('Significant age concern');
    }
  } else if (position === 'WR') {
    // WR age curve is moderate
    if (age <= 24) {
      score = 8000;
      notes.push('Prime WR age');
    } else if (age <= 27) {
      score = 7000;
    } else if (age <= 30) {
      score = 5500;
    } else if (age <= 32) {
      score = 4000;
      notes.push('Age decline risk');
    } else {
      score = 2500;
    }
  } else if (position === 'TE') {
    // TE age curve is lenient
    if (age <= 25) {
      score = 7500;
    } else if (age <= 29) {
      score = 7000;
    } else if (age <= 32) {
      score = 5500;
    } else {
      score = 3500;
    }
  } else if (position === 'QB') {
    // QB age curve is very lenient
    if (age <= 27) {
      score = 7000;
    } else if (age <= 33) {
      score = 7500;
      notes.push('QB prime');
    } else if (age <= 37) {
      score = 6000;
    } else {
      score = 4000;
    }
  } else if (['DL', 'LB', 'DB'].includes(position)) {
    // IDP age curve
    if (age <= 26) {
      score = 7000;
    } else if (age <= 30) {
      score = 6000;
    } else {
      score = 4000;
    }
  }

  return score;
}

/**
 * Calculate situation score from depth chart and team context
 * Returns 0-10000 range
 */
function calculateSituationScore(player: PlayerProductionData, notes: string[]): number {
  let score = 5000; // Neutral baseline

  // Depth chart position
  if (player.depth_chart_position === 1) {
    score += 2000;
  } else if (player.depth_chart_position === 2) {
    score += 500;
  } else if (player.depth_chart_position && player.depth_chart_position >= 3) {
    score -= 500;
  }

  // Status
  const status = (player.status || '').toLowerCase();
  if (status.includes('active')) {
    score += 500;
  } else if (status.includes('ir') || status.includes('out')) {
    score -= 1000;
    notes.push('Injury concern');
  } else if (status.includes('questionable') || status.includes('doubtful')) {
    score -= 500;
  }

  // Team offensive context
  if (player.team_offensive_rank !== undefined) {
    if (player.team_offensive_rank <= 5) {
      score += 500;
      notes.push('Top offense');
    } else if (player.team_offensive_rank >= 28) {
      score -= 300;
      notes.push('Weak offense');
    }
  }

  return Math.max(0, Math.min(10000, score));
}

/**
 * Fallback calculation when no production data is available
 * Uses basic heuristics but marks as low confidence
 */
function calculateFallbackValues(
  player: PlayerProductionData,
  notes: string[]
): ProductionCalculatedValues {
  notes.push('FALLBACK: Using basic heuristics only');

  const position = player.player_position;
  const age = player.age || 25;

  // Very conservative base values
  let dynastyValue = 2500;
  let redraftValue = 2000;

  // Position adjustment
  if (['QB', 'RB', 'WR', 'TE'].includes(position)) {
    dynastyValue = 3500;
    redraftValue = 3000;
  }

  // Young players get slight boost in dynasty
  if (age <= 23) {
    dynastyValue += 500;
    notes.push('Youth potential');
  }

  // Active status bonus
  if (player.status.toLowerCase().includes('active')) {
    dynastyValue += 300;
    redraftValue += 300;
  }

  return {
    dynasty_value: dynastyValue,
    redraft_value: redraftValue,
    production_score: 2500,
    opportunity_score: 2500,
    age_score: 5000,
    situation_score: 5000,
    notes,
    value_epoch: getCurrentEpoch(),
  };
}
