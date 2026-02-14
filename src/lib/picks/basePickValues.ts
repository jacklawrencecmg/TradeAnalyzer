export type PickType = 'early_1st' | 'mid_1st' | 'late_1st' | 'early_2nd' | 'late_2nd' | '3rd';

export interface BasePickValue {
  pick: PickType;
  value: number;
  label: string;
  description: string;
}

export const basePickValues: Record<PickType, number> = {
  early_1st: 6500,
  mid_1st: 5500,
  late_1st: 4800,
  early_2nd: 3200,
  late_2nd: 2600,
  '3rd': 1200,
};

export const pickLabels: Record<PickType, string> = {
  early_1st: 'Early 1st (1.01-1.04)',
  mid_1st: 'Mid 1st (1.05-1.08)',
  late_1st: 'Late 1st (1.09-1.12)',
  early_2nd: 'Early 2nd (2.01-2.06)',
  late_2nd: 'Late 2nd (2.07-2.12)',
  '3rd': '3rd Round (3.01+)',
};

export const pickDescriptions: Record<PickType, string> = {
  early_1st: 'Premium rookie pick - elite prospect access',
  mid_1st: 'Strong first round pick - quality starter potential',
  late_1st: 'Late first round - solid contributor upside',
  early_2nd: 'Early second round - high-upside dart throw',
  late_2nd: 'Late second round - depth piece or lottery ticket',
  '3rd': 'Third round or later - long-term stash',
};

export function getBasePickValue(pick: PickType): number {
  return basePickValues[pick] || 0;
}

export function getPickLabel(pick: PickType): string {
  return pickLabels[pick] || pick;
}

export function getPickDescription(pick: PickType): string {
  return pickDescriptions[pick] || '';
}

export function parsePickType(pickString: string): PickType | null {
  const normalized = pickString.toLowerCase().trim();

  if (normalized.includes('early') && normalized.includes('1st')) {
    return 'early_1st';
  }
  if (normalized.includes('mid') && normalized.includes('1st')) {
    return 'mid_1st';
  }
  if (normalized.includes('late') && normalized.includes('1st')) {
    return 'late_1st';
  }
  if (normalized.includes('early') && normalized.includes('2nd')) {
    return 'early_2nd';
  }
  if (normalized.includes('late') && normalized.includes('2nd')) {
    return 'late_2nd';
  }
  if (normalized.includes('3rd') || normalized.includes('third')) {
    return '3rd';
  }

  if (normalized.match(/1\.(0[1-4])/)) {
    return 'early_1st';
  }
  if (normalized.match(/1\.(0[5-8])/)) {
    return 'mid_1st';
  }
  if (normalized.match(/1\.(09|1[0-2])/)) {
    return 'late_1st';
  }
  if (normalized.match(/2\.(0[1-6])/)) {
    return 'early_2nd';
  }
  if (normalized.match(/2\.(0[7-9]|1[0-2])/)) {
    return 'late_2nd';
  }
  if (normalized.match(/3\./)) {
    return '3rd';
  }

  return null;
}

export function getAllPickTypes(): PickType[] {
  return ['early_1st', 'mid_1st', 'late_1st', 'early_2nd', 'late_2nd', '3rd'];
}

export function getPickInfo(pick: PickType): BasePickValue {
  return {
    pick,
    value: getBasePickValue(pick),
    label: getPickLabel(pick),
    description: getPickDescription(pick),
  };
}
