import { formatMultipliers, type LeagueFormat, type Position } from './formatMultipliers';
import { rbAdjustmentPoints, type RbContext } from './rbAdjustments';

export function calcFdpValue(
  ktcValue: number,
  position: Position,
  format: LeagueFormat = 'dynasty_sf'
): number {
  const multiplier = formatMultipliers[format]?.[position] ?? 1;
  return Math.round(ktcValue * multiplier);
}

export function calcFdpValueFromKtc({
  ktcValue,
  position,
  format,
  ctx,
}: {
  ktcValue: number;
  position: string;
  format: string;
  ctx?: any;
}): number {
  const normalizedFormat = convertFormatKey(format);
  const mult = formatMultipliers[normalizedFormat]?.[position as Position] ?? 1;
  let base = Math.round(ktcValue * mult);

  if (position === 'RB' && ctx) {
    base += rbAdjustmentPoints(ctx);
  }

  return Math.max(0, Math.min(10000, base));
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
