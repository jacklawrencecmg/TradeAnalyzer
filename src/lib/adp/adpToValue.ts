export function adpToRedraftValue(adp: number): number {
  if (!adp || adp <= 0) {
    return 0;
  }

  const rawValue = 10000 * Math.exp(-0.018 * adp);

  const clamped = Math.max(0, Math.min(10000, Math.round(rawValue)));

  return clamped;
}

export function getAdpTier(adp: number): {
  tier: string;
  description: string;
} {
  if (adp <= 12) {
    return { tier: 'elite', description: 'First Round Elite' };
  } else if (adp <= 24) {
    return { tier: 'rb1-wr1', description: 'Top Tier Starter' };
  } else if (adp <= 60) {
    return { tier: 'starter', description: 'Weekly Starter' };
  } else if (adp <= 100) {
    return { tier: 'flex', description: 'Flex/Depth' };
  } else if (adp <= 150) {
    return { tier: 'bench', description: 'Bench Depth' };
  } else if (adp <= 200) {
    return { tier: 'deep', description: 'Deep League Only' };
  } else {
    return { tier: 'waiver', description: 'Waiver Wire' };
  }
}

export function estimateAdpFromValue(value: number): number {
  if (value >= 10000) return 1;
  if (value <= 0) return 300;

  const adp = Math.log(value / 10000) / -0.018;
  return Math.round(Math.max(1, Math.min(300, adp)));
}
