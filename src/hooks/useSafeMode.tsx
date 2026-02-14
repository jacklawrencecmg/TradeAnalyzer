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
          table: 'system_config',
          filter: 'key=eq.safe_mode',
        },
        (payload) => {
          if (payload.new && payload.new.value) {
            setSafeMode(payload.new.value as SafeModeConfig);
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
        .from('system_config')
        .select('value')
        .eq('key', 'safe_mode')
        .maybeSingle();

      if (error) {
        console.error('Error checking safe mode:', error);
        return;
      }

      if (data?.value) {
        setSafeMode(data.value as SafeModeConfig);
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
