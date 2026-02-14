import { formatMultipliers, type LeagueFormat, type Position } from './formatMultipliers';

export function calcFdpValue(
  ktcValue: number,
  position: Position,
  format: LeagueFormat = 'dynasty_sf'
): number {
  const multiplier = formatMultipliers[format]?.[position] ?? 1;
  return Math.round(ktcValue * multiplier);
}

export function convertFormatKey(format: string): LeagueFormat {
  const normalized = format.replace(/-/g, '_');
  if (normalized === 'dynasty_superflex') return 'dynasty_sf';
  if (normalized === 'dynasty_1qb') return 'dynasty_1qb';
  if (normalized === 'dynasty_tep') return 'dynasty_tep';
  return 'dynasty_sf';
}

export function isValidPosition(pos: string): pos is Position {
  return ['QB', 'RB', 'WR', 'TE'].includes(pos);
}
