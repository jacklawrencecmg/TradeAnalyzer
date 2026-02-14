import { getIdpPreset, type IDPScoringPreset } from '../idp/getIdpPreset';
import { getPresetMultiplier, idpPresetMultipliers } from './idpPresetMultipliers';

export function applyIdpPreset(
  value: number,
  position: string,
  format: string
): number {
  const preset = getIdpPreset(format);
  const mult = getPresetMultiplier(position, preset);
  return Math.round(value * mult);
}

export function applyIdpPresetDirect(
  value: number,
  position: string,
  preset: IDPScoringPreset
): number {
  const mult = getPresetMultiplier(position, preset);
  return Math.round(value * mult);
}

export function calculatePresetAdjustment(
  baseValue: number,
  position: string,
  format: string
): {
  baseValue: number;
  preset: IDPScoringPreset;
  multiplier: number;
  adjustedValue: number;
  changeAmount: number;
  changePercent: number;
} {
  const preset = getIdpPreset(format);
  const multiplier = getPresetMultiplier(position, preset);
  const adjustedValue = Math.round(baseValue * multiplier);
  const changeAmount = adjustedValue - baseValue;
  const changePercent = Math.round((changeAmount / baseValue) * 100);

  return {
    baseValue,
    preset,
    multiplier,
    adjustedValue,
    changeAmount,
    changePercent,
  };
}

export function getPresetExplanation(
  position: string,
  format: string
): string {
  const preset = getIdpPreset(format);
  const multiplier = getPresetMultiplier(position, preset);
  const change = Math.round((multiplier - 1) * 100);

  if (preset === 'tackle_heavy') {
    if (position === 'LB') {
      return `+${change}% in Tackle-Heavy leagues (LBs dominate with consistent tackle volume)`;
    }
    if (position === 'DL') {
      return `${change}% in Tackle-Heavy leagues (fewer big play bonuses hurt pass rushers)`;
    }
    return `${change >= 0 ? '+' : ''}${change}% in Tackle-Heavy leagues (moderate tackle production valued)`;
  }

  if (preset === 'big_play') {
    if (position === 'DL') {
      return `+${change}% in Big-Play leagues (sack bonuses make EDGE rushers premium)`;
    }
    if (position === 'LB') {
      return `${change}% in Big-Play leagues (fewer points for tackles, more for TFLs/sacks)`;
    }
    return `${change}% in Big-Play leagues (INTs valued but tackle points reduced)`;
  }

  return `${change >= 0 ? '+' : ''}${change}% in Balanced leagues (standard IDP scoring)`;
}

export function getAllPresetValues(
  baseValue: number,
  position: string
): Record<IDPScoringPreset, number> {
  return {
    tackle_heavy: applyIdpPresetDirect(baseValue, position, 'tackle_heavy'),
    balanced: applyIdpPresetDirect(baseValue, position, 'balanced'),
    big_play: applyIdpPresetDirect(baseValue, position, 'big_play'),
  };
}

export function getPresetComparison(
  baseValue: number,
  position: string
): Array<{
  preset: IDPScoringPreset;
  value: number;
  multiplier: number;
  change: number;
  changePercent: number;
  label: string;
}> {
  const presets: IDPScoringPreset[] = ['tackle_heavy', 'balanced', 'big_play'];
  const balancedValue = applyIdpPresetDirect(baseValue, position, 'balanced');

  return presets.map(preset => {
    const multiplier = getPresetMultiplier(position, preset);
    const value = applyIdpPresetDirect(baseValue, position, preset);
    const change = value - balancedValue;
    const changePercent = Math.round((change / balancedValue) * 100);

    let label = '';
    if (preset === 'tackle_heavy') {
      label = position === 'LB' ? 'Best' : position === 'DL' ? 'Worst' : 'Good';
    } else if (preset === 'big_play') {
      label = position === 'DL' ? 'Best' : position === 'LB' ? 'Worst' : 'Below Avg';
    } else {
      label = 'Baseline';
    }

    return {
      preset,
      value,
      multiplier,
      change,
      changePercent,
      label,
    };
  });
}

export function shouldTargetPosition(
  position: string,
  format: string
): { shouldTarget: boolean; reason: string; priority: number } {
  const preset = getIdpPreset(format);
  const multiplier = getPresetMultiplier(position, preset);

  if (multiplier >= 1.20) {
    return {
      shouldTarget: true,
      reason: `${position} are premium in ${preset} scoring (+${Math.round((multiplier - 1) * 100)}%)`,
      priority: 1,
    };
  }

  if (multiplier >= 1.05) {
    return {
      shouldTarget: true,
      reason: `${position} are solid in ${preset} scoring (+${Math.round((multiplier - 1) * 100)}%)`,
      priority: 2,
    };
  }

  if (multiplier >= 0.95) {
    return {
      shouldTarget: true,
      reason: `${position} are neutral in ${preset} scoring`,
      priority: 3,
    };
  }

  return {
    shouldTarget: false,
    reason: `${position} are devalued in ${preset} scoring (${Math.round((multiplier - 1) * 100)}%)`,
    priority: 4,
  };
}
