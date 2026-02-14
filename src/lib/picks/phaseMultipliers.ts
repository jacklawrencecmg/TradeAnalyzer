import { SeasonPhase } from './seasonPhase';

export const phaseMultipliers: Record<SeasonPhase, number> = {
  playoffs: 0.92,
  pre_draft_hype: 1.08,
  rookie_fever: 1.18,
  post_draft_correction: 1.02,
  camp_battles: 1.05,
  season: 0.95,
  trade_deadline_push: 1.00,
};

export const phaseMultiplierDescriptions: Record<SeasonPhase, string> = {
  playoffs: '-8% (Contenders prioritize proven talent)',
  pre_draft_hype: '+8% (Rising buzz as draft approaches)',
  rookie_fever: '+18% (Peak hype at draft time)',
  post_draft_correction: '+2% (Slight premium after landing spots known)',
  camp_battles: '+5% (Training camp optimism)',
  season: '-5% (Focus shifts to current season)',
  trade_deadline_push: '±0% (Balanced market)',
};

export function getPhaseMultiplier(phase: SeasonPhase): number {
  return phaseMultipliers[phase] || 1.0;
}

export function getMultiplierDescription(phase: SeasonPhase): string {
  return phaseMultiplierDescriptions[phase] || '±0%';
}

export function getMultiplierPercentage(phase: SeasonPhase): string {
  const multiplier = getPhaseMultiplier(phase);
  const percentage = Math.round((multiplier - 1) * 100);

  if (percentage > 0) {
    return `+${percentage}%`;
  }
  if (percentage < 0) {
    return `${percentage}%`;
  }
  return '±0%';
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}x`;
}

export function calculateAdjustment(baseValue: number, multiplier: number): number {
  return Math.round(baseValue * multiplier - baseValue);
}

export function getAdjustmentDescription(baseValue: number, phase: SeasonPhase): string {
  const multiplier = getPhaseMultiplier(phase);
  const adjustment = calculateAdjustment(baseValue, multiplier);
  const percentage = getMultiplierPercentage(phase);

  if (adjustment > 0) {
    return `+${adjustment} (${percentage})`;
  }
  if (adjustment < 0) {
    return `${adjustment} (${percentage})`;
  }
  return 'No adjustment';
}
