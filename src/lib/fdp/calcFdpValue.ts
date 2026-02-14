import { formatMultipliers, type LeagueFormat, type Position } from './formatMultipliers';
import { rbAdjustmentPoints, type RbContext } from './rbAdjustments';
import { getIDPMultiplier, isIDPPosition, type IDPPosition, type IDPFormat } from '../idp/idpMultipliers';
import { calculateIDPAdjustments, clampIDPValue } from '../idp/idpAdjustments';
import { applyIdpPreset } from './applyIdpPreset';
import { getIdpPreset } from '../idp/getIdpPreset';

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
  positionGroup,
  subPosition,
  age,
}: {
  ktcValue: number;
  position: string;
  format: string;
  ctx?: any;
  positionGroup?: string;
  subPosition?: string;
  age?: number;
}): number {
  if (positionGroup === 'IDP' && isIDPPosition(position)) {
    return calcIDPFdpValue(ktcValue, position, format, subPosition, age);
  }

  const normalizedFormat = convertFormatKey(format);
  const mult = formatMultipliers[normalizedFormat]?.[position as Position] ?? 1;
  let base = Math.round(ktcValue * mult);

  if (position === 'RB' && ctx) {
    base += rbAdjustmentPoints(ctx);
  }

  return Math.max(0, Math.min(10000, base));
}

export function calcIDPFdpValue(
  ktcValue: number,
  position: IDPPosition,
  format: string,
  subPosition?: string,
  age?: number
): number {
  const idpFormat = convertToIDPFormat(format);
  const multiplier = getIDPMultiplier(position, idpFormat);

  let base = Math.round(ktcValue * multiplier);

  const adjustmentResult = calculateIDPAdjustments(
    position,
    subPosition,
    age
  );

  base += adjustmentResult.total;

  const withPreset = applyIdpPreset(base, position, format);

  return clampIDPValue(withPreset);
}

export function convertFormatKey(format: string): LeagueFormat {
  const normalized = format.replace(/-/g, '_');
  if (normalized === 'dynasty_superflex') return 'dynasty_sf';
  if (normalized === 'dynasty_1qb') return 'dynasty_1qb';
  if (normalized === 'dynasty_tep') return 'dynasty_tep';
  if (normalized === 'dynasty_sf_idp') return 'dynasty_sf';
  if (normalized === 'dynasty_1qb_idp') return 'dynasty_1qb';
  return 'dynasty_sf';
}

export function convertToIDPFormat(format: string): IDPFormat {
  const normalized = format.replace(/-/g, '_');
  if (normalized === 'dynasty_sf_idp' || normalized === 'dynasty_superflex_idp') return 'dynasty_sf_idp';
  if (normalized === 'dynasty_1qb_idp') return 'dynasty_1qb_idp';
  if (normalized === 'dynasty_sf_idp123') return 'dynasty_sf_idp123';
  return 'dynasty_sf_idp';
}

export function isValidPosition(pos: string): pos is Position {
  return ['QB', 'RB', 'WR', 'TE'].includes(pos);
}

export function isValidIDPPosition(pos: string): pos is IDPPosition {
  return isIDPPosition(pos);
}

export function getPositionGroup(position: string): 'OFF' | 'IDP' {
  if (isValidPosition(position)) return 'OFF';
  if (isValidIDPPosition(position)) return 'IDP';
  return 'OFF';
}
