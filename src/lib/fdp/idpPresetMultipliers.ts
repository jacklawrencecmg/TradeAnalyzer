import type { IDPScoringPreset } from '../idp/getIdpPreset';

export interface IDPPresetMultipliers {
  LB: number;
  DL: number;
  DB: number;
}

export const idpPresetMultipliers: Record<IDPScoringPreset, IDPPresetMultipliers> = {
  tackle_heavy: {
    LB: 1.30,
    DL: 0.95,
    DB: 1.05,
  },
  balanced: {
    LB: 1.15,
    DL: 1.05,
    DB: 1.00,
  },
  big_play: {
    LB: 0.95,
    DL: 1.25,
    DB: 0.90,
  },
};

export function getPresetMultiplier(
  position: string,
  preset: IDPScoringPreset
): number {
  if (position === 'LB') return idpPresetMultipliers[preset].LB;
  if (position === 'DL') return idpPresetMultipliers[preset].DL;
  if (position === 'DB') return idpPresetMultipliers[preset].DB;
  return 1.0;
}

export function getPresetImpact(
  position: string,
  preset: IDPScoringPreset
): { multiplier: number; change: number; description: string } {
  const baselinePreset: IDPScoringPreset = 'balanced';
  const currentMultiplier = getPresetMultiplier(position, preset);
  const baselineMultiplier = getPresetMultiplier(position, baselinePreset);

  const change = Math.round((currentMultiplier / baselineMultiplier - 1) * 100);

  let description = '';
  if (preset === 'tackle_heavy') {
    if (position === 'LB') {
      description = 'LBs dominate tackle-heavy scoring with consistent volume';
    } else if (position === 'DL') {
      description = 'DL lose value without big play bonuses';
    } else {
      description = 'DBs maintain decent value with tackle contributions';
    }
  } else if (preset === 'big_play') {
    if (position === 'LB') {
      description = 'LBs lose value without tackle premium';
    } else if (position === 'DL') {
      description = 'Pass rushers become premium assets with sack bonuses';
    } else {
      description = 'DBs lose value despite INT potential';
    }
  } else {
    description = 'Standard IDP scoring with balanced contributions';
  }

  return {
    multiplier: currentMultiplier,
    change,
    description,
  };
}

export function comparePresets(
  position: string,
  currentPreset: IDPScoringPreset,
  alternatePreset: IDPScoringPreset
): {
  current: number;
  alternate: number;
  difference: number;
  percentDifference: number;
  recommendation: string;
} {
  const current = getPresetMultiplier(position, currentPreset);
  const alternate = getPresetMultiplier(position, alternatePreset);
  const difference = alternate - current;
  const percentDifference = Math.round((difference / current) * 100);

  let recommendation = '';
  if (Math.abs(percentDifference) < 5) {
    recommendation = `Minimal impact switching from ${currentPreset} to ${alternatePreset}`;
  } else if (percentDifference > 0) {
    recommendation = `${position} gains ${percentDifference}% value in ${alternatePreset} scoring`;
  } else {
    recommendation = `${position} loses ${Math.abs(percentDifference)}% value in ${alternatePreset} scoring`;
  }

  return {
    current,
    alternate,
    difference,
    percentDifference,
    recommendation,
  };
}

export function getOptimalPositions(preset: IDPScoringPreset): string[] {
  const multipliers = idpPresetMultipliers[preset];
  const positions = [
    { pos: 'LB', mult: multipliers.LB },
    { pos: 'DL', mult: multipliers.DL },
    { pos: 'DB', mult: multipliers.DB },
  ];

  return positions
    .sort((a, b) => b.mult - a.mult)
    .map(p => p.pos);
}

export function getPresetStrategy(preset: IDPScoringPreset): {
  priority: string[];
  targetTypes: Record<string, string[]>;
  avoid: string[];
} {
  if (preset === 'tackle_heavy') {
    return {
      priority: ['LB', 'DB', 'DL'],
      targetTypes: {
        LB: ['ILB', 'MLB'],
        DB: ['S'],
        DL: ['DT'],
      },
      avoid: ['Pass rush specialists with low tackle floors'],
    };
  }

  if (preset === 'big_play') {
    return {
      priority: ['DL', 'LB', 'DB'],
      targetTypes: {
        DL: ['EDGE'],
        LB: ['OLB'],
        DB: ['CB'],
      },
      avoid: ['Pure run stuffers without sack/turnover upside'],
    };
  }

  return {
    priority: ['LB', 'DL', 'DB'],
    targetTypes: {
      LB: ['ILB', 'OLB'],
      DL: ['EDGE', 'DT'],
      DB: ['S', 'CB'],
    },
    avoid: ['One-dimensional players'],
  };
}
