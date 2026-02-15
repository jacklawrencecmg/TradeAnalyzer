/**
 * Player Value Calculations
 *
 * Calculates dynasty and redraft values for all players using deterministic scoring.
 * This provides baseline values that can be overridden by scraped market values.
 */

interface PlayerForValuation {
  id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  status: string;
  years_exp: number | null;
  depth_chart_position: number | null;
  injury_status: string | null;
  birthdate: string | null;
  metadata?: any;
}

export interface CalculatedValues {
  dynasty_value: number;
  redraft_value: number;
  notes: string[];
}

/**
 * Base values by position (starting point before adjustments)
 */
const BASE_VALUES = {
  dynasty: {
    QB: 5200,
    RB: 4800,
    WR: 5000,
    TE: 4300,
    LB: 3400,
    DL: 3200,
    DB: 2900,
    K: 1500,
    DEF: 2000,
  },
  redraft: {
    QB: 5000,
    RB: 5200,
    WR: 5000,
    TE: 4200,
    LB: 3000,
    DL: 3200,
    DB: 2700,
    K: 1800,
    DEF: 2200,
  },
};

/**
 * Calculate dynasty and redraft values for a player
 */
export function calculatePlayerValues(player: PlayerForValuation): CalculatedValues {
  const position = player.player_position || 'UNKNOWN';
  const notes: string[] = [];

  // Get base values
  let dynastyValue = BASE_VALUES.dynasty[position as keyof typeof BASE_VALUES.dynasty] || 2000;
  let redraftValue = BASE_VALUES.redraft[position as keyof typeof BASE_VALUES.redraft] || 2000;

  notes.push(`Base: D${dynastyValue} R${redraftValue}`);

  // Apply status adjustments
  const statusAdjust = applyStatusAdjustments(player, notes);
  dynastyValue += statusAdjust.dynasty;
  redraftValue += statusAdjust.redraft;

  // Apply depth chart adjustments
  const depthAdjust = applyDepthChartAdjustments(player, notes);
  dynastyValue += depthAdjust.dynasty;
  redraftValue += depthAdjust.redraft;

  // Apply age curve adjustments
  const ageAdjust = applyAgeCurveAdjustments(player, notes);
  dynastyValue += ageAdjust.dynasty;
  redraftValue += ageAdjust.redraft;

  // Apply experience adjustments
  const expAdjust = applyExperienceAdjustments(player, notes);
  dynastyValue += expAdjust.dynasty;
  redraftValue += expAdjust.redraft;

  // Apply injury adjustments
  const injuryAdjust = applyInjuryAdjustments(player, notes);
  dynastyValue += injuryAdjust.dynasty;
  redraftValue += injuryAdjust.redraft;

  // Clamp values to 0-10000 range
  dynastyValue = Math.max(0, Math.min(10000, Math.round(dynastyValue)));
  redraftValue = Math.max(0, Math.min(10000, Math.round(redraftValue)));

  return {
    dynasty_value: dynastyValue,
    redraft_value: redraftValue,
    notes: notes,
  };
}

/**
 * Status adjustments
 */
function applyStatusAdjustments(
  player: PlayerForValuation,
  notes: string[]
): { dynasty: number; redraft: number } {
  const status = (player.status || 'Active').toLowerCase();

  if (status.includes('active')) {
    notes.push('Active +400');
    return { dynasty: 400, redraft: 400 };
  }

  if (status.includes('injured reserve') || status.includes('ir')) {
    notes.push('IR -300');
    return { dynasty: -300, redraft: -500 };
  }

  if (status.includes('practice squad') || status.includes('ps')) {
    notes.push('Practice Squad -900');
    return { dynasty: -900, redraft: -1200 };
  }

  if (status.includes('free agent') || status.includes('fa')) {
    notes.push('FA -450');
    return { dynasty: -450, redraft: -600 };
  }

  if (status.includes('pup')) {
    notes.push('PUP -400');
    return { dynasty: -400, redraft: -700 };
  }

  if (status.includes('suspension') || status.includes('suspended')) {
    notes.push('Suspended -600');
    return { dynasty: -600, redraft: -900 };
  }

  return { dynasty: 0, redraft: 0 };
}

/**
 * Depth chart position adjustments
 */
function applyDepthChartAdjustments(
  player: PlayerForValuation,
  notes: string[]
): { dynasty: number; redraft: number } {
  const depth = player.depth_chart_position;

  if (depth === null || depth === undefined) {
    return { dynasty: 0, redraft: 0 };
  }

  if (depth === 1) {
    notes.push('DC1 +500');
    return { dynasty: 500, redraft: 600 };
  }

  if (depth === 2) {
    notes.push('DC2 +150');
    return { dynasty: 150, redraft: 100 };
  }

  if (depth >= 3) {
    notes.push('DC3+ -250');
    return { dynasty: -250, redraft: -400 };
  }

  return { dynasty: 0, redraft: 0 };
}

/**
 * Age curve adjustments
 */
function applyAgeCurveAdjustments(
  player: PlayerForValuation,
  notes: string[]
): { dynasty: number; redraft: number } {
  const age = calculateAge(player);
  if (!age) return { dynasty: 0, redraft: 0 };

  const position = player.player_position;

  // Running backs - harsh age curve
  if (position === 'RB') {
    if (age >= 26) {
      notes.push('RB age 26+ -900D');
      return { dynasty: -900, redraft: -500 };
    }
    if (age <= 23) {
      notes.push('RB age ≤23 +450D');
      return { dynasty: 450, redraft: 200 };
    }
  }

  // Wide receivers - moderate age curve
  if (position === 'WR') {
    if (age >= 30) {
      notes.push('WR age 30+ -600D');
      return { dynasty: -600, redraft: -250 };
    }
    if (age <= 25) {
      notes.push('WR age ≤25 +350D');
      return { dynasty: 350, redraft: 100 };
    }
  }

  // Tight ends - moderate age curve
  if (position === 'TE') {
    if (age >= 30) {
      notes.push('TE age 30+ -500D');
      return { dynasty: -500, redraft: -200 };
    }
    if (age <= 25) {
      notes.push('TE age ≤25 +300D');
      return { dynasty: 300, redraft: 100 };
    }
  }

  // Quarterbacks - lenient age curve
  if (position === 'QB') {
    if (age >= 37) {
      notes.push('QB age 37+ -400D');
      return { dynasty: -400, redraft: -200 };
    }
    if (age >= 27 && age <= 32) {
      notes.push('QB prime +200D');
      return { dynasty: 200, redraft: 150 };
    }
  }

  // IDP - young preference
  if (['DL', 'LB', 'DB'].includes(position)) {
    if (age >= 30) {
      notes.push('IDP age 30+ -400D');
      return { dynasty: -400, redraft: -200 };
    }
    if (age <= 25) {
      notes.push('IDP age ≤25 +200D');
      return { dynasty: 200, redraft: 50 };
    }
  }

  // General old age penalty
  if (age >= 30) {
    notes.push('Age 30+ -300D');
    return { dynasty: -300, redraft: -150 };
  }

  return { dynasty: 0, redraft: 0 };
}

/**
 * Experience adjustments
 */
function applyExperienceAdjustments(
  player: PlayerForValuation,
  notes: string[]
): { dynasty: number; redraft: number } {
  const exp = player.years_exp;
  if (exp === null || exp === undefined) {
    return { dynasty: 0, redraft: 0 };
  }

  // Rookies and second year
  if (exp <= 1) {
    notes.push('Rookie/2nd year +250D/-150R');
    return { dynasty: 250, redraft: -150 };
  }

  // Prime years
  if (exp >= 2 && exp <= 5) {
    notes.push('Prime years +100');
    return { dynasty: 100, redraft: 100 };
  }

  // Veterans
  if (exp >= 10) {
    notes.push('Veteran 10+ -300D/-200R');
    return { dynasty: -300, redraft: -200 };
  }

  return { dynasty: 0, redraft: 0 };
}

/**
 * Injury status adjustments
 */
function applyInjuryAdjustments(
  player: PlayerForValuation,
  notes: string[]
): { dynasty: number; redraft: number } {
  const injury = (player.injury_status || '').toLowerCase();

  if (!injury) return { dynasty: 0, redraft: 0 };

  if (injury.includes('out')) {
    notes.push('Injury Out -400');
    return { dynasty: -200, redraft: -400 };
  }

  if (injury.includes('doubtful')) {
    notes.push('Injury Doubtful -300');
    return { dynasty: -150, redraft: -300 };
  }

  if (injury.includes('questionable')) {
    notes.push('Injury Questionable -150');
    return { dynasty: -75, redraft: -150 };
  }

  return { dynasty: 0, redraft: 0 };
}

/**
 * Calculate player age from birthdate
 */
function calculateAge(player: PlayerForValuation): number | null {
  if (!player.birthdate) {
    // Try from metadata
    const age = player.metadata?.age;
    if (typeof age === 'number') return age;
    return null;
  }

  try {
    const birthDate = new Date(player.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return null;
  }
}

/**
 * Normalize a market value from external source to 0-10000 scale
 */
export function normalizeMarketValue(
  rawValue: number,
  source: string,
  position: string
): number {
  // KTC values are typically 0-10000 already
  if (source === 'KTC') {
    return Math.max(0, Math.min(10000, Math.round(rawValue)));
  }

  // DraftSharks IDP - normalize based on position-specific ranges
  if (source === 'DraftSharks') {
    // DraftSharks typically uses 0-100 scale
    // Map to 0-10000 with position-specific ceiling
    if (['DL', 'LB', 'DB'].includes(position)) {
      // IDP positions: top tier = ~4000-5000
      return Math.max(0, Math.min(5000, Math.round(rawValue * 50)));
    }
  }

  // Default: assume 0-100 scale, map to 0-10000
  return Math.max(0, Math.min(10000, Math.round(rawValue * 100)));
}
