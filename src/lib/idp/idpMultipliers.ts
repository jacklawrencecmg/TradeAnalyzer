export type IDPPosition = 'DL' | 'LB' | 'DB';
export type IDPFormat = 'dynasty_sf_idp' | 'dynasty_1qb_idp' | 'dynasty_sf_idp123';
export type ScoringStyle = 'tackle_heavy' | 'balanced' | 'big_play';

export interface IDPFormatMultipliers {
  DL: number;
  LB: number;
  DB: number;
}

export const idpMultipliers: Record<IDPFormat, IDPFormatMultipliers> = {
  dynasty_sf_idp: {
    DL: 1.35,
    LB: 1.40,
    DB: 1.25,
  },
  dynasty_1qb_idp: {
    DL: 1.35,
    LB: 1.40,
    DB: 1.25,
  },
  dynasty_sf_idp123: {
    DL: 1.40,
    LB: 1.45,
    DB: 1.22,
  },
};

export const scoringStyleMultipliers: Record<ScoringStyle, IDPFormatMultipliers> = {
  tackle_heavy: {
    DL: 1.10,
    LB: 1.50,
    DB: 1.35,
  },
  balanced: {
    DL: 1.25,
    LB: 1.25,
    DB: 1.25,
  },
  big_play: {
    DL: 1.45,
    LB: 1.20,
    DB: 1.30,
  },
};

export function getIDPMultiplier(
  position: IDPPosition,
  format: IDPFormat = 'dynasty_sf_idp',
  scoringStyle: ScoringStyle = 'balanced'
): number {
  const formatMultiplier = idpMultipliers[format][position] || 1.0;
  const styleMultiplier = scoringStyleMultipliers[scoringStyle][position] || 1.0;

  return formatMultiplier * styleMultiplier;
}

export function getMultiplierDescription(
  position: IDPPosition,
  format: IDPFormat,
  scoringStyle: ScoringStyle
): string {
  const descriptions: Record<IDPPosition, string> = {
    DL: 'Defensive line - sack/pressure specialists',
    LB: 'Linebackers - tackle volume leaders',
    DB: 'Defensive backs - coverage specialists',
  };

  const multiplier = getIDPMultiplier(position, format, scoringStyle);
  const change = Math.round((multiplier - 1) * 100);
  const changeText = change > 0 ? `+${change}%` : change < 0 ? `${change}%` : 'baseline';

  return `${descriptions[position]} (${changeText})`;
}

export function isIDPPosition(position: string): position is IDPPosition {
  return ['DL', 'LB', 'DB'].includes(position);
}

export function getIDPPositionLabel(position: IDPPosition): string {
  const labels: Record<IDPPosition, string> = {
    DL: 'Defensive Line',
    LB: 'Linebacker',
    DB: 'Defensive Back',
  };
  return labels[position];
}

export function getSubPositionLabel(subPosition: string): string {
  const labels: Record<string, string> = {
    EDGE: 'Edge Rusher',
    DT: 'Defensive Tackle',
    NT: 'Nose Tackle',
    ILB: 'Inside Linebacker',
    OLB: 'Outside Linebacker',
    MLB: 'Middle Linebacker',
    CB: 'Cornerback',
    S: 'Safety',
    FS: 'Free Safety',
    SS: 'Strong Safety',
  };
  return labels[subPosition] || subPosition;
}

export function getAllIDPPositions(): IDPPosition[] {
  return ['DL', 'LB', 'DB'];
}

export function getAllIDPFormats(): IDPFormat[] {
  return ['dynasty_sf_idp', 'dynasty_1qb_idp', 'dynasty_sf_idp123'];
}

export function getAllScoringStyles(): ScoringStyle[] {
  return ['tackle_heavy', 'balanced', 'big_play'];
}

export function getScoringStyleLabel(style: ScoringStyle): string {
  const labels: Record<ScoringStyle, string> = {
    tackle_heavy: 'Tackle Heavy',
    balanced: 'Balanced',
    big_play: 'Big Play',
  };
  return labels[style];
}

export function getScoringStyleDescription(style: ScoringStyle): string {
  const descriptions: Record<ScoringStyle, string> = {
    tackle_heavy: 'Emphasizes tackle volume (LB/DB premium)',
    balanced: 'Equal weight to all IDP production types',
    big_play: 'Rewards sacks, INTs, forced fumbles (DL/DB premium)',
  };
  return descriptions[style];
}
