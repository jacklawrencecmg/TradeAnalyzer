import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SafeModeConfig {
  enabled: boolean;
  reason: string | null;
  since: string | null;
}

export function useSafeMode() {
  const [safeMode, setSafeMode] = useState<SafeModeConfig>({
    enabled: false,
    reason: null,
    since: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSafeMode();

    const channel = supabase
      .channel('safe_mode_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_safe_mode',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001',
        },
        (payload) => {
          if (payload.new) {
            setSafeMode({
              enabled: payload.new.enabled,
              reason: payload.new.reason,
              since: payload.new.enabled_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function checkSafeMode() {
    try {
      const { data, error } = await supabase
        .from('system_safe_mode')
        .select('enabled, reason, enabled_at')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      if (error) {
        console.error('Error checking safe mode:', error);
        return;
      }

      if (data) {
        setSafeMode({
          enabled: data.enabled,
          reason: data.reason,
          since: data.enabled_at,
        });
      }
    } catch (err) {
      console.error('Error checking safe mode:', err);
    } finally {
      setLoading(false);
    }
  }

  return { safeMode, loading };
}

export function shouldDisableWrites(safeMode: SafeModeConfig): boolean {
  return safeMode.enabled;
}

export function shouldDisableFeature(
  feature: 'trade_suggestions' | 'market_trends' | 'rankings_regeneration' | 'trade_analyzer',
  safeMode: SafeModeConfig
): boolean {
  if (!safeMode.enabled) return false;

  const disabledFeatures: string[] = [
    'trade_suggestions',
    'market_trends',
    'rankings_regeneration',
  ];

  return disabledFeatures.includes(feature);
}
