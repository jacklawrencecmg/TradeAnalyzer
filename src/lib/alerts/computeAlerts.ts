export type AlertType =
  | 'value_spike'
  | 'value_drop'
  | 'buy_low'
  | 'sell_high'
  | 'role_change'
  | 'trending_up'
  | 'trending_down';

export type AlertSeverity = 'low' | 'medium' | 'high';

export interface PlayerAlert {
  player_id: string;
  alert_type: AlertType;
  message: string;
  severity: AlertSeverity;
  metadata: {
    value_now?: number;
    value_7d?: number;
    change_7d?: number;
    change_7d_pct?: number;
    trend_tag?: string;
    signal_strength?: number;
    old_role?: string;
    new_role?: string;
  };
}

export interface PlayerSnapshot {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  value_now: number;
  value_7d: number;
  change_7d: number;
  change_7d_pct: number;
  trend_tag?: string;
  signal_strength?: number;
  rb_context?: string;
  previous_rb_context?: string;
}

const VALUE_SPIKE_THRESHOLD = 600;
const VALUE_DROP_THRESHOLD = -600;
const TRENDING_UP_THRESHOLD = 300;
const TRENDING_DOWN_THRESHOLD = -300;

export function computePlayerAlerts(player: PlayerSnapshot): PlayerAlert[] {
  const alerts: PlayerAlert[] = [];

  if (player.change_7d >= VALUE_SPIKE_THRESHOLD) {
    const severity = player.change_7d >= 1000 ? 'high' : player.change_7d >= 800 ? 'medium' : 'low';

    alerts.push({
      player_id: player.player_id,
      alert_type: 'value_spike',
      message: `${player.player_name} spiked +${player.change_7d.toLocaleString()} (${player.change_7d_pct > 0 ? '+' : ''}${player.change_7d_pct}%) in 7 days!`,
      severity,
      metadata: {
        value_now: player.value_now,
        value_7d: player.value_7d,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d <= VALUE_DROP_THRESHOLD) {
    const severity = player.change_7d <= -1000 ? 'high' : player.change_7d <= -800 ? 'medium' : 'low';

    alerts.push({
      player_id: player.player_id,
      alert_type: 'value_drop',
      message: `${player.player_name} dropped ${player.change_7d.toLocaleString()} (${player.change_7d_pct}%) in 7 days`,
      severity,
      metadata: {
        value_now: player.value_now,
        value_7d: player.value_7d,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d >= TRENDING_UP_THRESHOLD && player.change_7d < VALUE_SPIKE_THRESHOLD) {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'trending_up',
      message: `${player.player_name} is trending up +${player.change_7d.toLocaleString()} this week`,
      severity: 'low',
      metadata: {
        value_now: player.value_now,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.change_7d <= TRENDING_DOWN_THRESHOLD && player.change_7d > VALUE_DROP_THRESHOLD) {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'trending_down',
      message: `${player.player_name} is trending down ${player.change_7d.toLocaleString()} this week`,
      severity: 'low',
      metadata: {
        value_now: player.value_now,
        change_7d: player.change_7d,
        change_7d_pct: player.change_7d_pct,
      },
    });
  }

  if (player.trend_tag === 'buy_low') {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'buy_low',
      message: `${player.player_name} is now a BUY LOW opportunity! (Signal: ${player.signal_strength}%)`,
      severity: player.signal_strength && player.signal_strength >= 80 ? 'high' : 'medium',
      metadata: {
        value_now: player.value_now,
        trend_tag: player.trend_tag,
        signal_strength: player.signal_strength,
        change_7d: player.change_7d,
      },
    });
  }

  if (player.trend_tag === 'sell_high') {
    alerts.push({
      player_id: player.player_id,
      alert_type: 'sell_high',
      message: `${player.player_name} is now a SELL HIGH opportunity! (Signal: ${player.signal_strength}%)`,
      severity: player.signal_strength && player.signal_strength >= 80 ? 'high' : 'medium',
      metadata: {
        value_now: player.value_now,
        trend_tag: player.trend_tag,
        signal_strength: player.signal_strength,
        change_7d: player.change_7d,
      },
    });
  }

  if (player.position === 'RB' && player.rb_context && player.previous_rb_context) {
    const roleChanged = detectRoleChange(player.previous_rb_context, player.rb_context);

    if (roleChanged) {
      const { severity, message } = roleChanged;

      alerts.push({
        player_id: player.player_id,
        alert_type: 'role_change',
        message: `${player.player_name}: ${message}`,
        severity,
        metadata: {
          old_role: player.previous_rb_context,
          new_role: player.rb_context,
          value_now: player.value_now,
          change_7d: player.change_7d,
        },
      });
    }
  }

  return alerts;
}

function detectRoleChange(
  oldContext: string,
  newContext: string
): { severity: AlertSeverity; message: string } | null {
  const oldRole = normalizeRole(oldContext);
  const newRole = normalizeRole(newContext);

  if (oldRole === newRole) return null;

  if (oldRole === 'handcuff' && newRole === 'starter') {
    return {
      severity: 'high',
      message: 'Promoted from handcuff to starter!',
    };
  }

  if (oldRole === 'handcuff' && newRole === 'committee') {
    return {
      severity: 'medium',
      message: 'Now in committee (was handcuff)',
    };
  }

  if (oldRole === 'starter' && newRole === 'committee') {
    return {
      severity: 'medium',
      message: 'Lost clear starter role, now in committee',
    };
  }

  if (oldRole === 'starter' && newRole === 'handcuff') {
    return {
      severity: 'high',
      message: 'Lost starter role, now handcuff',
    };
  }

  if (oldRole === 'committee' && newRole === 'starter') {
    return {
      severity: 'high',
      message: 'Emerged as clear starter from committee!',
    };
  }

  if (oldRole === 'committee' && newRole === 'handcuff') {
    return {
      severity: 'medium',
      message: 'Role reduced from committee to handcuff',
    };
  }

  return null;
}

function normalizeRole(context: string): 'starter' | 'committee' | 'handcuff' | 'unknown' {
  const lower = context.toLowerCase();

  if (lower.includes('clear starter') || lower.includes('bellcow') || lower.includes('workhorse')) {
    return 'starter';
  }

  if (lower.includes('committee') || lower.includes('split') || lower.includes('timeshare')) {
    return 'committee';
  }

  if (lower.includes('handcuff') || lower.includes('backup')) {
    return 'handcuff';
  }

  return 'unknown';
}

export function deduplicateAlerts(alerts: PlayerAlert[]): PlayerAlert[] {
  const seen = new Map<string, PlayerAlert>();

  const priorityOrder: AlertType[] = [
    'role_change',
    'buy_low',
    'sell_high',
    'value_spike',
    'value_drop',
    'trending_up',
    'trending_down',
  ];

  const severityScore = { high: 3, medium: 2, low: 1 };

  for (const alert of alerts) {
    const key = alert.player_id;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, alert);
      continue;
    }

    const existingPriority = priorityOrder.indexOf(existing.alert_type);
    const newPriority = priorityOrder.indexOf(alert.alert_type);

    if (newPriority < existingPriority) {
      seen.set(key, alert);
    } else if (newPriority === existingPriority) {
      if (severityScore[alert.severity] > severityScore[existing.severity]) {
        seen.set(key, alert);
      }
    }
  }

  return Array.from(seen.values());
}

export function filterSignificantAlerts(alerts: PlayerAlert[]): PlayerAlert[] {
  return alerts.filter(alert => {
    if (alert.severity === 'high') return true;
    if (alert.severity === 'medium') return true;

    if (alert.severity === 'low') {
      if (alert.alert_type === 'trending_up' || alert.alert_type === 'trending_down') {
        return Math.abs(alert.metadata.change_7d || 0) >= 400;
      }
      return true;
    }

    return false;
  });
}

export function sortAlertsByPriority(alerts: PlayerAlert[]): PlayerAlert[] {
  const severityScore = { high: 3, medium: 2, low: 1 };

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return severityScore[b.severity] - severityScore[a.severity];
    }

    const aChange = Math.abs(a.metadata.change_7d || 0);
    const bChange = Math.abs(b.metadata.change_7d || 0);
    return bChange - aChange;
  });
}
