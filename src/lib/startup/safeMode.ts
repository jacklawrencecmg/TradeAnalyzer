/**
 * Safe Mode Startup Fallback
 *
 * Gracefully degrade when critical checks fail.
 * Prevents serving incorrect data to users.
 *
 * Safe Mode Features:
 * - Rankings disabled
 * - Trade analyzer disabled
 * - Show maintenance banner
 * - Admin endpoints still available
 * - Read-only mode for data views
 */

import { supabase } from '../supabase';

export type SystemMode = 'normal' | 'maintenance' | 'read-only' | 'offline';

export interface SafeModeStatus {
  mode: SystemMode;
  reason?: string;
  enabledAt?: string;
  disabledFeatures: string[];
  availableFeatures: string[];
}

const SAFE_MODE_KEY = 'system_mode';

/**
 * Get current system mode
 */
export async function getSystemMode(): Promise<SystemMode> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', SAFE_MODE_KEY)
      .maybeSingle();

    return (data?.value as SystemMode) || 'normal';
  } catch (error) {
    console.error('Error getting system mode:', error);
    return 'normal';
  }
}

/**
 * Set system mode
 */
export async function setSystemMode(
  mode: SystemMode,
  reason?: string
): Promise<void> {
  try {
    await supabase.from('system_config').upsert({
      key: SAFE_MODE_KEY,
      value: mode,
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`🔧 System mode set to: ${mode}`);
    if (reason) {
      console.log(`   Reason: ${reason}`);
    }
  } catch (error) {
    console.error('Error setting system mode:', error);
  }
}

/**
 * Enable safe mode
 */
export async function enableSafeMode(reason: string): Promise<void> {
  await setSystemMode('maintenance', reason);

  // Log to audit
  try {
    await supabase.from('admin_audit_log').insert({
      action: 'safe_mode_enabled',
      actor: 'system',
      metadata: { reason },
    });
  } catch (error) {
    console.error('Error logging safe mode:', error);
  }
}

/**
 * Disable safe mode
 */
export async function disableSafeMode(): Promise<void> {
  await setSystemMode('normal');

  // Log to audit
  try {
    await supabase.from('admin_audit_log').insert({
      action: 'safe_mode_disabled',
      actor: 'system',
    });
  } catch (error) {
    console.error('Error logging safe mode disable:', error);
  }
}

/**
 * Get safe mode status
 */
export async function getSafeModeStatus(): Promise<SafeModeStatus> {
  const mode = await getSystemMode();

  const disabledFeatures: string[] = [];
  const availableFeatures: string[] = [];

  if (mode === 'maintenance') {
    disabledFeatures.push('Rankings', 'Trade Analyzer', 'Player Search', 'Exports');
    availableFeatures.push('Admin Panel', 'System Health', 'Documentation');
  } else if (mode === 'read-only') {
    disabledFeatures.push('Trade Analyzer', 'Exports', 'Data Updates');
    availableFeatures.push('Rankings', 'Player Search', 'Admin Panel (Read)');
  } else if (mode === 'offline') {
    disabledFeatures.push('All Features');
    availableFeatures.push('Error Page');
  } else {
    availableFeatures.push('All Features');
  }

  // Get reason from config
  let reason: string | undefined;
  let enabledAt: string | undefined;

  try {
    const { data } = await supabase
      .from('system_config')
      .select('metadata')
      .eq('key', SAFE_MODE_KEY)
      .maybeSingle();

    if (data?.metadata) {
      reason = data.metadata.reason;
      enabledAt = data.metadata.timestamp;
    }
  } catch (error) {
    console.error('Error getting safe mode details:', error);
  }

  return {
    mode,
    reason,
    enabledAt,
    disabledFeatures,
    availableFeatures,
  };
}

/**
 * Check if feature is enabled
 */
export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const mode = await getSystemMode();

  if (mode === 'normal') {
    return true;
  }

  if (mode === 'offline') {
    return false;
  }

  const disabledInMaintenance = [
    'rankings',
    'trade-analyzer',
    'player-search',
    'exports',
    'data-updates',
  ];

  const disabledInReadOnly = ['trade-analyzer', 'exports', 'data-updates'];

  if (mode === 'maintenance') {
    return !disabledInMaintenance.includes(feature.toLowerCase());
  }

  if (mode === 'read-only') {
    return !disabledInReadOnly.includes(feature.toLowerCase());
  }

  return true;
}

/**
 * Require feature enabled or throw
 */
export async function requireFeatureEnabled(feature: string): Promise<void> {
  const enabled = await isFeatureEnabled(feature);

  if (!enabled) {
    throw new Error(
      `Feature "${feature}" is disabled. System is in maintenance mode.`
    );
  }
}

/**
 * Safe mode middleware for API routes
 */
export async function withSafeModeCheck<T>(
  feature: string,
  handler: () => Promise<T>
): Promise<T> {
  const mode = await getSystemMode();

  if (mode === 'normal') {
    return handler();
  }

  const enabled = await isFeatureEnabled(feature);

  if (!enabled) {
    throw new Error(`System is in ${mode} mode. Feature "${feature}" is disabled.`);
  }

  return handler();
}

/**
 * Automatic safe mode triggers
 */
export async function checkSafeModeTriggers(): Promise<void> {
  try {
    // Check error rate
    const { data: recentErrors } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('success', false)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (recentErrors && recentErrors.length > 10) {
      await enableSafeMode('High error rate detected (10+ errors in 5 minutes)');
      return;
    }

    // Check rebuild failures
    const { data: rebuildFailures } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'rebuild_failed')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(2);

    if (rebuildFailures && rebuildFailures.length >= 2) {
      await enableSafeMode('Multiple rebuild failures detected (2+ in 1 hour)');
      return;
    }

    // Check value mismatch
    const { data: healthChecks } = await supabase
      .from('system_health_checks')
      .select('*')
      .eq('check_type', 'value_integrity')
      .eq('status', 'critical')
      .gte('checked_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1);

    if (healthChecks && healthChecks.length > 0) {
      await enableSafeMode('Value integrity check failed');
      return;
    }
  } catch (error) {
    console.error('Error checking safe mode triggers:', error);
  }
}

/**
 * Get safe mode banner message
 */
export async function getSafeModeBanner(): Promise<{
  show: boolean;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}> {
  const status = await getSafeModeStatus();

  if (status.mode === 'normal') {
    return {
      show: false,
      title: '',
      message: '',
      severity: 'info',
    };
  }

  if (status.mode === 'maintenance') {
    return {
      show: true,
      title: 'System Maintenance',
      message:
        'We are updating our data. Some features are temporarily unavailable.',
      severity: 'warning',
    };
  }

  if (status.mode === 'read-only') {
    return {
      show: true,
      title: 'Read-Only Mode',
      message: 'System is in read-only mode. Data updates are disabled.',
      severity: 'info',
    };
  }

  if (status.mode === 'offline') {
    return {
      show: true,
      title: 'System Offline',
      message: 'The system is currently offline for maintenance.',
      severity: 'error',
    };
  }

  return {
    show: false,
    title: '',
    message: '',
    severity: 'info',
  };
}

/**
 * In-memory cache for system mode (avoid repeated DB queries)
 */
let cachedMode: SystemMode | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getSystemModeCached(): Promise<SystemMode> {
  const now = Date.now();

  if (cachedMode && now - cacheTime < CACHE_TTL) {
    return cachedMode;
  }

  cachedMode = await getSystemMode();
  cacheTime = now;

  return cachedMode;
}

/**
 * Clear system mode cache
 */
export function clearSystemModeCache(): void {
  cachedMode = null;
  cacheTime = 0;
}
