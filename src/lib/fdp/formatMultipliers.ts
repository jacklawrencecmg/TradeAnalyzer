export type LeagueFormat = 'dynasty_sf' | 'dynasty_1qb' | 'dynasty_tep';
export type Position = 'QB' | 'RB' | 'WR' | 'TE';

export const formatMultipliers: Record<LeagueFormat, Record<Position, number>> = {
  dynasty_sf: {
    QB: 1.35,
    RB: 1.15,
    WR: 1.0,
    TE: 1.10,
  },
  dynasty_1qb: {
    QB: 1.0,
    RB: 1.18,
    WR: 1.0,
    TE: 1.10,
  },
  dynasty_tep: {
    QB: 1.35,
    RB: 1.15,
    WR: 1.0,
    TE: 1.25,
  },
};

export const pickValueChart: Record<string, number> = {
  '1.01': 9500,
  '1.02': 9200,
  '1.03': 8900,
  '1.04': 8600,
  '1.05': 8300,
  '1.06': 8000,
  '1.07': 7700,
  '1.08': 7400,
  '1.09': 7100,
  '1.10': 6800,
  '1.11': 6500,
  '1.12': 6200,
  'early_1st': 8500,
  'mid_1st': 6500,
  'late_1st': 4800,
  '2nd': 2500,
  'early_2nd': 3000,
  'mid_2nd': 2500,
  'late_2nd': 2000,
  '3rd': 1200,
  '4th': 500,
};

export function normalizePickName(pick: string): string {
  const lower = pick.toLowerCase().trim();

  if (lower.includes('early') && lower.includes('1')) return 'early_1st';
  if (lower.includes('mid') && lower.includes('1')) return 'mid_1st';
  if (lower.includes('late') && lower.includes('1')) return 'late_1st';

  if (lower.includes('early') && lower.includes('2')) return 'early_2nd';
  if (lower.includes('mid') && lower.includes('2')) return 'mid_2nd';
  if (lower.includes('late') && lower.includes('2')) return 'late_2nd';

  if (lower.match(/1\.0[1-9]|1\.1[0-2]/)) {
    return lower.replace(/\s/g, '');
  }

  if (lower.includes('2nd') || lower.includes('2.')) return '2nd';
  if (lower.includes('3rd') || lower.includes('3.')) return '3rd';
  if (lower.includes('4th') || lower.includes('4.')) return '4th';

  if (lower.includes('1st') || lower.includes('1.')) return 'mid_1st';

  return lower;
}

export function getPickValue(pick: string): number {
  const normalized = normalizePickName(pick);
  return pickValueChart[normalized] || 0;
}
