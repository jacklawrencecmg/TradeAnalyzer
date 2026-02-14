export type TrendTag = 'buy_low' | 'sell_high' | 'rising' | 'falling' | 'stable';

export interface PlayerTrend {
  player_id: string;
  name: string;
  position: string;
  team: string | null;
  value_now: number;
  value_7d: number;
  value_30d: number;
  change_7d: number;
  change_30d: number;
  change_7d_pct: number;
  change_30d_pct: number;
  volatility: number;
  tag: TrendTag;
  signal_strength: number;
}

interface ValueSnapshot {
  fdp_value: number;
  snapshot_date: string;
}

export function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

export function interpolateValue(
  snapshots: ValueSnapshot[],
  daysAgo: number
): number {
  if (snapshots.length === 0) return 0;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  targetDate.setHours(0, 0, 0, 0);

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  );

  const exactMatch = sorted.find(s => {
    const snapDate = new Date(s.snapshot_date);
    snapDate.setHours(0, 0, 0, 0);
    return snapDate.getTime() === targetDate.getTime();
  });

  if (exactMatch) return exactMatch.fdp_value;

  let before: ValueSnapshot | null = null;
  let after: ValueSnapshot | null = null;

  for (const snapshot of sorted) {
    const snapDate = new Date(snapshot.snapshot_date);
    snapDate.setHours(0, 0, 0, 0);

    if (snapDate.getTime() <= targetDate.getTime()) {
      before = snapshot;
    } else if (snapDate.getTime() > targetDate.getTime() && !after) {
      after = snapshot;
      break;
    }
  }

  if (before && after) {
    const beforeDate = new Date(before.snapshot_date).getTime();
    const afterDate = new Date(after.snapshot_date).getTime();
    const targetTime = targetDate.getTime();

    const ratio = (targetTime - beforeDate) / (afterDate - beforeDate);
    return before.fdp_value + ratio * (after.fdp_value - before.fdp_value);
  }

  if (before) return before.fdp_value;
  if (after) return after.fdp_value;

  return sorted[sorted.length - 1].fdp_value;
}

export function determineTrendTag(
  valueNow: number,
  change7d: number,
  change30d: number,
  volatility: number,
  recentWeeklyAvgChange: number
): { tag: TrendTag; strength: number } {
  if (valueNow < 500) {
    return { tag: 'stable', strength: 0 };
  }

  const volatilityRatio = volatility / Math.max(valueNow, 1);
  const isVolatilityStabilizing = volatilityRatio < 0.15;

  if (change30d <= -700 && isVolatilityStabilizing && valueNow >= 1000) {
    const strength = Math.min(100, Math.abs(change30d) / 10);
    return { tag: 'buy_low', strength };
  }

  const isSpike = Math.abs(change7d) > Math.abs(recentWeeklyAvgChange) * 2;
  if (change30d >= 900 && isSpike) {
    const strength = Math.min(100, change30d / 15);
    return { tag: 'sell_high', strength };
  }

  if (change7d >= 250 && change7d <= 900) {
    const strength = Math.min(100, change7d / 10);
    return { tag: 'rising', strength };
  }

  if (change7d <= -250 && change7d >= -900) {
    const strength = Math.min(100, Math.abs(change7d) / 10);
    return { tag: 'falling', strength };
  }

  return { tag: 'stable', strength: 0 };
}

export function analyzePlayerTrend(
  playerId: string,
  name: string,
  position: string,
  team: string | null,
  snapshots: ValueSnapshot[]
): PlayerTrend | null {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  );

  const valueNow = sorted[0].fdp_value;
  const value7d = interpolateValue(snapshots, 7);
  const value30d = interpolateValue(snapshots, 30);

  const change7d = valueNow - value7d;
  const change30d = valueNow - value30d;

  const change7dPct = value7d > 0 ? (change7d / value7d) * 100 : 0;
  const change30dPct = value30d > 0 ? (change30d / value30d) * 100 : 0;

  const recentValues = sorted.slice(0, Math.min(14, sorted.length)).map(s => s.fdp_value);
  const volatility = calculateVolatility(recentValues);

  const weeklyChanges: number[] = [];
  for (let i = 0; i < sorted.length - 7; i += 7) {
    const current = sorted[i].fdp_value;
    const weekAgo = sorted[Math.min(i + 7, sorted.length - 1)].fdp_value;
    weeklyChanges.push(current - weekAgo);
  }

  const recentWeeklyAvgChange = weeklyChanges.length > 0
    ? weeklyChanges.reduce((sum, c) => sum + c, 0) / weeklyChanges.length
    : 0;

  const { tag, strength } = determineTrendTag(
    valueNow,
    change7d,
    change30d,
    volatility,
    recentWeeklyAvgChange
  );

  return {
    player_id: playerId,
    name,
    position,
    team,
    value_now: Math.round(valueNow),
    value_7d: Math.round(value7d),
    value_30d: Math.round(value30d),
    change_7d: Math.round(change7d),
    change_30d: Math.round(change30d),
    change_7d_pct: Math.round(change7dPct * 10) / 10,
    change_30d_pct: Math.round(change30dPct * 10) / 10,
    volatility: Math.round(volatility),
    tag,
    signal_strength: Math.round(strength),
  };
}

export function sortPlayerTrends(trends: PlayerTrend[], tag?: TrendTag): PlayerTrend[] {
  let filtered = tag ? trends.filter(t => t.tag === tag) : trends;

  return filtered.sort((a, b) => {
    if (a.signal_strength !== b.signal_strength) {
      return b.signal_strength - a.signal_strength;
    }

    if (tag === 'buy_low' || tag === 'falling') {
      return a.change_30d - b.change_30d;
    }

    if (tag === 'sell_high' || tag === 'rising') {
      return b.change_30d - a.change_30d;
    }

    return b.value_now - a.value_now;
  });
}

export function filterPlayerTrends(
  trends: PlayerTrend[],
  filters: {
    tag?: TrendTag;
    position?: string;
    minValue?: number;
    maxValue?: number;
  }
): PlayerTrend[] {
  let filtered = [...trends];

  if (filters.tag) {
    filtered = filtered.filter(t => t.tag === filters.tag);
  }

  if (filters.position) {
    filtered = filtered.filter(t => t.position === filters.position);
  }

  if (filters.minValue !== undefined) {
    filtered = filtered.filter(t => t.value_now >= filters.minValue!);
  }

  if (filters.maxValue !== undefined) {
    filtered = filtered.filter(t => t.value_now <= filters.maxValue!);
  }

  return sortPlayerTrends(filtered, filters.tag);
}

export function getTrendColor(tag: TrendTag): string {
  switch (tag) {
    case 'buy_low':
      return 'green';
    case 'sell_high':
      return 'red';
    case 'rising':
      return 'blue';
    case 'falling':
      return 'orange';
    case 'stable':
    default:
      return 'gray';
  }
}

export function getTrendLabel(tag: TrendTag): string {
  switch (tag) {
    case 'buy_low':
      return 'Buy Low';
    case 'sell_high':
      return 'Sell High';
    case 'rising':
      return 'Rising';
    case 'falling':
      return 'Falling';
    case 'stable':
    default:
      return 'Stable';
  }
}

export function getTrendIcon(tag: TrendTag): string {
  switch (tag) {
    case 'buy_low':
      return '📉';
    case 'sell_high':
      return '📈';
    case 'rising':
      return '⬆️';
    case 'falling':
      return '⬇️';
    case 'stable':
    default:
      return '➡️';
  }
}
