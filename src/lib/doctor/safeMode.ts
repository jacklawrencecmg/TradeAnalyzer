import { supabase } from '../supabase';

export interface SafeModeState {
  enabled: boolean;
  reason: string | null;
  critical_issues: any[];
  enabled_at: string | null;
  updated_at: string;
}

export async function getSafeModeState(): Promise<SafeModeState | null> {
  try {
    const { data, error } = await supabase
      .from('system_safe_mode')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .maybeSingle();

    if (error) {
      console.error('Failed to get safe mode state:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get safe mode state:', error);
    return null;
  }
}

export async function isSafeModeEnabled(): Promise<boolean> {
  const state = await getSafeModeState();
  return state?.enabled ?? false;
}

export function enforceSafeMode(operation: string): void | never {
  // This would be checked by write operations
  // For now, we'll just log a warning
  console.warn(`⚠️ Attempted ${operation} while in safe mode`);
}

export async function checkSafeModeBeforeWrite(operationName: string): Promise<void> {
  const enabled = await isSafeModeEnabled();

  if (enabled) {
    throw new Error(
      `Cannot perform ${operationName}: System is in safe mode due to critical data integrity issues. ` +
      `Please run Doctor audit and repair to resolve issues first.`
    );
  }
}

// Safe mode banner component helper
export function getSafeModeBannerMessage(state: SafeModeState | null): string | null {
  if (!state?.enabled) {
    return null;
  }

  return state.reason || 'System is in safe mode due to critical issues';
}
