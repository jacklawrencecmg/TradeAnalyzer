import { getSeasonPhase, type SeasonPhase } from './seasonPhase';
import { basePickValues, type PickType, parsePickType } from './basePickValues';
import { getPhaseMultiplier } from './phaseMultipliers';

export interface PickValueResult {
  pick: PickType;
  season: number;
  baseValue: number;
  adjustedValue: number;
  phase: SeasonPhase;
  multiplier: number;
  adjustment: number;
}

export function getAdjustedPickValue(
  pick: PickType,
  phase?: SeasonPhase
): number {
  const currentPhase = phase || getSeasonPhase();
  const baseValue = basePickValues[pick] || 0;
  const multiplier = getPhaseMultiplier(currentPhase);

  return Math.round(baseValue * multiplier);
}

export function calculatePickValue(
  pick: PickType,
  season: number,
  customPhase?: SeasonPhase
): PickValueResult {
  const phase = customPhase || getSeasonPhase();
  const baseValue = basePickValues[pick] || 0;
  const multiplier = getPhaseMultiplier(phase);
  const adjustedValue = Math.round(baseValue * multiplier);
  const adjustment = adjustedValue - baseValue;

  return {
    pick,
    season,
    baseValue,
    adjustedValue,
    phase,
    multiplier,
    adjustment,
  };
}

export function parseAndCalculatePickValue(
  pickString: string,
  season: number = new Date().getFullYear() + 1
): PickValueResult | null {
  const pickType = parsePickType(pickString);
  if (!pickType) return null;

  return calculatePickValue(pickType, season);
}

export function calculateMultiplePicksValue(
  picks: Array<{ pick: PickType; season: number }>
): number {
  return picks.reduce((total, { pick }) => {
    return total + getAdjustedPickValue(pick);
  }, 0);
}

export function comparePickValues(
  pick1: PickType,
  pick2: PickType,
  phase?: SeasonPhase
): number {
  const value1 = getAdjustedPickValue(pick1, phase);
  const value2 = getAdjustedPickValue(pick2, phase);
  return value1 - value2;
}

export function getPickValueRange(
  picks: PickType[],
  phase?: SeasonPhase
): { min: number; max: number; total: number } {
  const values = picks.map(pick => getAdjustedPickValue(pick, phase));

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    total: values.reduce((sum, val) => sum + val, 0),
  };
}

export function formatPickValue(value: number): string {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

export function getPickValueWithOverride(
  pick: PickType,
  manualOverride?: number
): number {
  if (manualOverride !== undefined && manualOverride !== null) {
    return manualOverride;
  }
  return getAdjustedPickValue(pick);
}
